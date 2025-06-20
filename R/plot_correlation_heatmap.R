#' plot_correlation_heatmap(ExpObj = NULL, glomby = NULL, stattype = "spearman", subsetby = NULL, maxnumfeatallowed = 10000, minabscorrcoeff = NULL, ntopvar = NULL, featuresToKeep = NULL, samplesToKeep = NULL, applyfilters = NULL, featcutoff = NULL, GenomeCompletenessCutoff = NULL, show_GenomeCompleteness_boxplot = TRUE, PctFromCtgscutoff = NULL, PPM_normalize_to_bases_sequenced = FALSE, showGram = TRUE, showphylum = TRUE, addtit = NULL, asPPM = TRUE, cdict = NULL, ignoreunclassified = TRUE, class_to_ignore = NULL, returnstats = FALSE)
#'
#' Plots correlation heatmaps annotated by the metadata or a correlelogram of features
#' @export

plot_correlation_heatmap <- function(ExpObj = NULL, glomby = NULL, stattype = "spearman", subsetby = NULL, maxnumfeatallowed = 10000, minabscorrcoeff = NULL, ntopvar = NULL, featuresToKeep = NULL, samplesToKeep = NULL, applyfilters = NULL, featcutoff = NULL, GenomeCompletenessCutoff = NULL, show_GenomeCompleteness_boxplot = TRUE, PctFromCtgscutoff = NULL, PPM_normalize_to_bases_sequenced = FALSE, showGram = TRUE, showphylum = TRUE, addtit = NULL, asPPM = TRUE, cdict = NULL, ignoreunclassified = TRUE, class_to_ignore = NULL, returnstats = FALSE) {

    #Vet experiment object
    obj <- ExpObjVetting(ExpObj = ExpObj, samplesToKeep = samplesToKeep, featuresToKeep = featuresToKeep, glomby = glomby, class_to_ignore = class_to_ignore)

    analysis <- metadata(obj)$analysis
    if (!is.null(glomby)){
        analysisname <- glomby
    } else {
        analysisname <- analysis
    }

    presetlist <- declare_filtering_presets(analysis = analysis, applyfilters = applyfilters, featcutoff = featcutoff, GenomeCompletenessCutoff = GenomeCompletenessCutoff, PctFromCtgscutoff = PctFromCtgscutoff)

    if (!(is.null(subsetby))){
        subset_points <- sort(unique((colData(obj)[, which(colnames(colData(obj)) == subsetby)])))
    } else {
        subset_points <- "none"
    }

    #Initialize Stats and Graph Vector lists
    svec <- list()
    s <- 1
    n <- 1

    #subset by metadata column
    for (sp in 1:length(subset_points)) {
        if (!(is.null(subsetby))){
            samplesToKeep <- rownames(colData(obj))[which(colData(obj)[ , subsetby] == subset_points[sp])]
            flog.info(paste("Plotting within", subset_points[sp]))
            subsetname <- subset_points[sp]
        } else {
            samplesToKeep <- rownames(colData(obj))
            subsetname <- "no_sub"
        }

        currobj <- filter_experiment(ExpObj = obj, featcutoff = presetlist$featcutoff, samplesToKeep = samplesToKeep, featuresToKeep = featuresToKeep, asPPM = asPPM, PPM_normalize_to_bases_sequenced = PPM_normalize_to_bases_sequenced, GenomeCompletenessCutoff = presetlist$GenomeCompletenessCutoff, PctFromCtgscutoff = presetlist$PctFromCtgscutoff)

        numfeats <- nrow(currobj)

        #There must be at least three features for a correlation heatmap
        if (nrow(currobj) > 3){
            #Compose an appropriate title for the plot
            if (length(unique(subset_points)) > 1){
                maintit <- paste("Feature Correlation Heatmap", analysisname, paste("within", subset_points[sp]), sep = " | ")
            } else {
                maintit <- paste("Feature Correlation Heatmap", analysisname, sep = " | ")
            }
            if (!is.null(addtit)) {
                maintit <- paste(addtit, maintit, sep = "\n")
            }

            #Get counts matrix
            countmat <- as.matrix(assays(currobj)$BaseCounts)

            if (ignoreunclassified == TRUE){
                dunno <- c(paste(analysis, "none", sep = "_"), "LKT__d__Unclassified", "LKT__Unclassified")
                rowsToKeep <- which(!(rownames(countmat) %in% dunno))
                countmat <- countmat[rowsToKeep, ]
            }

            #Rename rows to include description if not taxonomic data
            if (analysis != "LKT"){
                feattable <- rowData(currobj)
                feattable$Feature <- paste(feattable$Accession, feattable$Description, sep = "-")
                rownames(countmat) <- feattable$Feature[match(rownames(countmat), feattable$Accession)]
            }
            matrixSamples <- colnames(countmat)
            matrixRows <- rownames(countmat)

            if (!is.null(ntopvar)){
                ntop <- min(ntopvar, nrow(countmat))
                featsds <- rowSds(countmat)
                featIndices <- names(featsds[order(featsds, decreasing = TRUE)[1:ntop]])
                countmat <- countmat[featIndices, ]
                ntopvarmsg <- paste("Top", ntop, "most variant features across samples")
            } else {
                ntopvarmsg <- NULL
            }

            docorrelations <- TRUE
            if (!(is.null(maxnumfeatallowed))) {
                if (nrow(countmat) > maxnumfeatallowed){
                    print(paste("There are", nrow(countmat), "features pairwise correlate, which is more than",  maxnumfeatallowed, "allowed. This would entail", (nrow(countmat) ^ 2) , "comparisons. If you are sure you want that many, set maxnumfeatallowed to a higher value."))
                    docorrelations <- FALSE
                }
            }

            if (docorrelations == TRUE){
                #Calculate matrix stats and get new matrix with correlations.
                matstats <- calculate_matrix_stats(countmatrix = countmat, uselog = FALSE, statsonlog = FALSE, stattype = stattype, classesdf = classesdf)

                if (!is.null(minabscorrcoeff)){
                    flog.info(paste("Eliminating features which do not correlate with other features with a coefficient of at least", minabscorrcoeff))
                    matstats <- filter_correlations(corrmat= matstats, mincorrelcoeff = minabscorrcoeff)
                    minabscorrcoeffmsg <- paste("Largest correlation coefficient at least", minabscorrcoeff)
                } else {
                    minabscorrcoeffmsg <- NULL
                }

                #Plot heatmap
                #Set scale
                #This is the colour spectrum we are aiming to span
                CorrHmColours <- c("blue4", "lightgoldenrodyellow", "red1")
                heatmapCols <- colorRamp2(c(-1, 0, 1), CorrHmColours)

                fontcoefficient <- (-0.05 * nrow(matstats)) + 7.5
                fontsizey <- round((((-1 / 300) * (nrow(matstats))) + 0.85 * fontcoefficient), 2)
                fontsizey <- max(0.5, fontsizey)

                #Add genome completeness info if LKT
                ha1 <- NULL
                ha2 <- NULL

                if (analysis == "LKT"){

                    if ("GenomeCompleteness" %in% names(assays(currobj))){
                        genomecompletenessdf <- assays(currobj)$GenomeCompleteness
                        genomecompletenessstats <- as.matrix(genomecompletenessdf[rownames(matstats), ])
                        gcl <- lapply(1:nrow(genomecompletenessstats), function (x){ (as.numeric(genomecompletenessstats[x, ][which(genomecompletenessstats[x, ] != 0)])) * 100 })
                    }

                    if (any(c(showGram, showphylum))){
                        data(Gram)
                        #Get Phyla
                        if (analysisname %in% c("LKT", "Species", "Genus", "Family", "Order", "Class")){
                            tt <- as.data.frame(rowData(currobj))
                            tt <- tt[rownames(matstats), ]
                            tt <- tt[ , c(analysisname, "Phylum")]

                            Gram$Kingdom <- NULL
                            tt <- left_join(tt, Gram)
                            tt$Gram[which(!(tt$Gram %in% c("positive", "negative")))] <- "not_sure"
                            phcol <- colorRampPalette((brewer.pal(9, "Set1")))(length(unique(tt$Phylum)))
                            names(phcol) <- unique(tt$Phylum)
                            phcol[which(names(phcol) == "p__Unclassified")] <- "#000000"
                            phcol <- phcol[!duplicated(phcol)]
                        }

                        if (show_GenomeCompleteness_boxplot){
                            ha1 <- rowAnnotation(Pct_Genome_Compl = anno_boxplot(gcl, width = unit(4, "cm"), pch = 20, size = unit(1, "mm"),  axis_param = list(labels_rot = 90)), Gram = tt$Gram, Phylum = tt$Phylum, col = list(Gram = c("positive" = "#7D00C4", "negative" = "#FC0345", "not_sure" = "#B8B8B8"), Phylum = phcol),  annotation_name_gp = gpar(fontsize = 6, col = "black"))
                        } else {
                            ha1 <- NULL
                        }

                        ha2 <- HeatmapAnnotation(Phylum = tt$Phylum, Gram = tt$Gram, col = list(Phylum = phcol, Gram = c("positive" = "#7D00C4", "negative" = "#FC0345", "not_sure" = "#B8B8B8")),  annotation_name_gp = gpar(fontsize = 6, col = "black"), show_legend = FALSE)
                    }
                }

                #Build plot title
                stattit <- paste("Correlation measure =", stattype)
                plotit <- paste(maintit, stattit, presetlist$filtermsg, ntopvarmsg, minabscorrcoeffmsg, sep = "\n")

                svec[[s]] <- matstats
                #Name stats in svec
                stattitle <- paste(analysisname, stattype, subsetname, sep = "_")
                names(svec)[s] <- stattitle
                s <- s + 1

                ht1 <- Heatmap(matstats, name = paste(stattype, "correlation coefficient"), column_title = plotit, column_title_gp = gpar(fontsize = 10), col = heatmapCols, column_dend_height = unit(5, "mm"), cluster_rows = TRUE, show_row_dend = FALSE, row_names_gp = gpar(fontsize = fontsizey), column_names_gp = gpar(fontsize = fontsizey), heatmap_legend_param = list(direction = "horizontal", legend_width = unit(6, "cm"), title = paste(stattype, "correlation coefficient"), labels = c(-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1), at = c(-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1), title_gp = gpar(fontsize = 8), labels_gp = gpar(fontsize = 6)), left_annotation = ha1, bottom_annotation = ha2)

                draw(ht1, heatmap_legend_side = "bottom", annotation_legend_side = "left", padding = unit(c(2, 20, 2, 2), "mm"))
            } #End conditional of going ahead and doing correlations if there arent too many features
        } #End conditional if there are any features left over after filtering
    } #End for loop for plotting within each subset point

    #Redefine stats list as ones only containing data
    #svec <- svec[sapply(svec, function(x){ !(is.null(x)) } )]

    if (returnstats == TRUE){
        return(svec)
    } else {
        return(print("Heatmaps generated."))
    }
}
