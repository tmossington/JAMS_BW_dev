import React, { useEffect, useState, useRef } from 'react';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Box from '@mui/material/Box';
import useAutoScroll from './common/useAutoScroll';
import LoadingIndicator from './common/LoadingIndicator';
import WarningSnackbar, { validateRequiredFields, useWarningState } from './common/warningMessage';

const RelabundFeatures = ({ handleNavigateTo }) => {
    const [parameters, setParameters] = useState({
        glomby: '',
        samplesToKeep: '',
        featuresToKeep: '',
        aggregatefeatures: false,
        aggregatefeatures_label: '',
        subsetby: '',
        compareby: '',
        paired: false,
        compareby_order: '',
        colourby: '',
        shapeby: '',
        fillby: '',
        connectby: '',
        facetby: '',
        wrap_facet: false,
        overlay_boxplot: false,
        applyfilters: 'none',
        featcutoff: '',
        GenomeCompletenessCutoff: '',
        PctFromCtgscutoff: '',
        ntop: '',
        minabscorrcoeff: '',
        adjustpval: true,
        padjmeth: 'fdr',
        showonlypbelow: '',
        showonlypadjusted: false,
        maxl2fc: '',
        minl2fc: '',
        addtit: '',
        PPM_normalize_to_bases_sequenced: false,
        log2tran_main_plot: false,
        log2tran_strat_plot: false,
        statsonlog: false,
        y_axis_range: '',
        cdict: '',
        stratify_by_taxlevel: '',
        annotate_phylum: true,
        maxnumplots: '',
        signiflabel: 'p.format',
        max_pairwise_cats: 4,
        dump_interpro_descriptions_to_plot: false,
        numthreads: 1,
        nperm: 99,
        ignoreunclassified: true,
        class_to_ignore: 'N_A',
        maxnumtaxa: 20,
        horizontal: true,
        plot_points_on_taxonomy: false,
        use_heatmap_for_stratification: true,
        return_taxon_stratification_df: false,
        return_plots: false,
        rescale_axis_quantiles: '',
    });

    const displayNames = {
        glomby: 'Glom By',
        samplesToKeep: 'Samples to Keep',
        featuresToKeep: 'Features to Keep',
        aggregatefeatures: 'Aggregate Features',
        aggregatefeatures_label: 'Aggregate Features Label',
        subsetby: 'Subset By',
        compareby: 'Compare By',
        paired: 'Paired',
        compareby_order: 'Compare By Order',
        colourby: 'Colour By',
        shapeby: 'Shape By',
        fillby: 'Fill By',
        connectby: 'Connect By',
        facetby: 'Facet By',
        wrap_facet: 'Wrap Facet',
        overlay_boxplot: 'Overlay Boxplot',
        applyfilters: 'Apply Filters',
        featcutoff: 'Feature Cutoff',
        GenomeCompletenessCutoff: 'Genome Completeness Cutoff',
        PctFromCtgscutoff: 'Percent from Contigs Cutoff',
        ntop: 'N Top',
        minabscorrcoeff: 'Minimum Absolute Correlation Coefficient',
        adjustpval: 'Adjust P-Value',
        padjmeth: 'P-Value Adjustment Method',
        showonlypbelow: 'Show Only P Below',
        showonlypadjusted: 'Show Only Adjusted P-Values',
        maxl2fc: 'Max Log2 Fold Change',
        minl2fc: 'Min Log2 Fold Change',
        addtit: 'Add Title',
        PPM_normalize_to_bases_sequenced: 'PPM Normalize to Bases Sequenced',
        log2tran_main_plot: 'Log2 Transform Main Plot',
        log2tran_strat_plot: 'Log2 Transform Stratified Plot',
        statsonlog: 'Statistics on Log',
        y_axis_range: 'Y-Axis Range',
        cdict: 'Color Dictionary',
        stratify_by_taxlevel: 'Stratify by Taxonomic Level',
        annotate_phylum: 'Annotate Phylum',
        maxnumplots: 'Max Number of Plots',
        signiflabel: 'Significance Label',
        max_pairwise_cats: 'Max Pairwise Categories',
        dump_interpro_descriptions_to_plot: 'Dump InterPro Descriptions to Plot',
        numthreads: 'Number of Threads',
        nperm: 'Number of Permutations',
        ignoreunclassified: 'Ignore Unclassified',
        class_to_ignore: 'Class to Ignore',
        maxnumtaxa: 'Max Number of Taxa',
        horizontal: 'Horizontal',
        plot_points_on_taxonomy: 'Plot Points on Taxonomy',
        use_heatmap_for_stratification: 'Use Heatmap for Stratification',
        return_taxon_stratification_df: 'Return Taxon Stratification DataFrame',
        return_plots: 'Return Plots',
        rescale_axis_quantiles: 'Rescale Axis Quantiles'
    };

    const [relabundfeatureData, setRelabundFeatureData] = useState(null);
    const [objects, setObjects] = useState([]);
    const [filePath, setFilePath] = useState('');
    const [selectedObj, setSelectedObj] = useState('')
    const [loading, setLoading] = useState(false);
    const [generatingRelabund, setGeneratingRelabnd] = useState(false);

    const resultRef = useRef(null);
    const loadingRef = useRef(null);

    // auto scroll to results when ready
    useAutoScroll(relabundfeatureData, resultRef);

    // auto scroll to loading indicator
    useAutoScroll(generatingRelabund, loadingRef);

    // Use the warning state hook
    const { showWarning, warningMessage, handleCloseWarning, showWarningMessage } = useWarningState();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setParameters({
            ...parameters,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationResult = validateRequiredFields({
            'R data file': filePath,
            'Summarized Experiment Object': selectedObj
        });

        if (!validationResult.isValid) {
            showWarningMessage(validationResult.message);
            return;
        }

        console.log('Selected ExpObj:', selectedObj);
        try {
            setLoading(true);
            setGeneratingRelabnd(true);
            // Combine the parameters with selected objects and file path
            const params = {
                filePath,
                ExpObj: selectedObj,
                ...parameters
            };

            // Call IPC method to run RelabundFeatures script
            const result = await window.electron.runRelabundFeaturesScript(params)

            // Update the AD data with result
            setRelabundFeatureData(result);
        } catch (error) {
            console.error("Error generating RelabundFeature plot:", error);
            setWarningMessage(`Error: ${error.message || 'Failed to generate heatmap'}`);
            setShowWarning(true);
        } finally {
            setLoading(false);
            setGeneratingRelabnd(false);
        }
    };

    const handleFileUpload = async () => {
        try {
            setLoading(true);
            const filePath = await window.electron.invoke('open-file-dialog');
            if (filePath) {
                setFilePath(filePath);
                const result = await window.electron.invoke('load-rdata-file', filePath);
                setObjects(result);

                // Set default selection to the first object, otherwise it will not default to any
                if (result.length > 0) {
                    setSelectedObj(result[0]);
                }

            }
        } catch (error) {
            console.error('Error opening file dialog:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleObjSelect = (e) => {
        const value = e.target.value;
        setSelectedObj(value);
        console.log('Selected object state:', value);
    };

    const handleDownloadClick = () => {
        // Send IPC event to open the relabundfeature PDF
        window.electron.send('open-RelabundFeatures-location');
    };

    useEffect(() => {
        // Set default selection if objects array changes
        if (objects.length > 0 && !selectedObj) {
            setSelectedObj(objects[0]);
        }
    }, [objects, selectedObj]);

    return (
        <div>
            <Button
                onClick={handleNavigateTo('home')}
                sx={{
                    position: 'absolute',
                    top: '60px',
                    right: '10px',
                }}
            >
                Go Back to Home Page
            </Button>

            {/* warning message */}
            <WarningSnackbar
                open={showWarning}
                message={warningMessage}
                onClose={handleCloseWarning}
            />

            <h1>Generate Relabund Feature Plot</h1>

            <div>
                {/* File upload for RData file */}
                <h3>Upload RData File for Relabund Feature Plot</h3>
                <Button
                    component='label'
                    variant='contained'
                    startIcon={<CloudUploadIcon />}
                    onClick={handleFileUpload}
                >
                    Upload RData File
                </Button>
            </div>

            {/* Dropdown for selecting Summarized Experiment Object */}
            {objects.length > 0 && (
                <div>
                    <h3>Select Summarized Experiment Object</h3>
                    <select onChange={handleObjSelect} value={selectedObj}>
                        {objects.map((obj, index) => (
                            <option key={index} value={obj}>
                                {obj}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Form for RelabundFeatures Parameters */}
            <form onSubmit={handleSubmit}>
                {Object.keys(parameters).map((key) => (
                    <div key={key}>
                        <label htmlFor={key}>{displayNames[key] || key}:</label>
                        {key === 'applyfilters' ? (
                            <select
                            id={key}
                            name={key}
                            value={parameters[key]}
                            onChange={handleChange}
                            >
                                <option value='none'>none</option>
                                <option value='light'>light</option>
                                <option value='moderate'>moderate</option>
                                <option value='stringent'>stringent</option>
                            </select>

                        ) : typeof parameters[key] === 'booleran' ? (
                            <input
                            type='checkbox'
                            id={key}
                            name={key}
                            checked={parameters[key]}
                            onChange={handleChange}
                            />
                        ): (
                            <input
                            type='text'
                            id={key}
                            name={key}
                            value={parameters[key]}
                            onChange={handleChange}
                            />
                        )}
                    </div>
                ))}
                <Button type='submit' variant='outlined' color='primary'>
                    Generate Relabund Features Plot
                </Button>
            </form>

            {/* Add loading indicator */}
            {loading && <LoadingIndicator ref={generatingRelabund ? loadingRef : null} />}

            {relabundfeatureData && !loading && (
                <div id="relabundfeature=container" ref={resultRef}>
                    <h2>Relabund Feature Plot</h2>
                    <Button
                    variant='contained'
                    color='primary'
                    onClick={handleDownloadClick}
                    >
                        Open Relabund Feature Plot PDf
                    </Button>
                </div>
            )}

        </div>
    );
};

export default RelabundFeatures
