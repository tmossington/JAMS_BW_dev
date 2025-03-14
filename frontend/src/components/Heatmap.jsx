import React, { useEffect, useState, useRef } from 'react';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Box from '@mui/material/Box';
import useAutoScroll from './common/useAutoScroll';
import LoadingIndicator from './common/LoadingIndicator';
import WarningSnackbar, { validateRequiredFields, useWarningState } from './common/warningMessage';


const Heatmap = ({ handleNavigateTo }) => {
    const [parameters, setParameters] = useState({
        glomby: '',
        hmtype: 'exploratory',
        samplesToKeep: '',
        featuresToKeep: '',
        applyfilters: 'none',
        featcutoff: '',
        GenomeCompletenessCutoff: '',
        PPM_normalize_to_bases_sequenced: false,
        subsetby: '',
        compareby: '',
        invertbinaryorder: false,
        showonlypbelow: '',
        adj_pval_for_threshold: false,
        ntop: '',
        colcategories: '',
        splitcolsby: '',
        ordercolsby: '',
        textby: '',
        cluster_samples_per_heatmap: false,
        cluster_features_per_heatmap: false,
        label_samples: false,
        cluster_rows: false,
        max_rows_in_heatmap: '',
        no_underscores: false,
        showGram: false,
        show_GenomeCompleteness: false,
        addtit: '',
        hmasPA: false,
        threshPA: 0,
        cluster_column_slices: true,
        column_split_group_order: '',
        row_order: '',
        discard_SDoverMean_below: '',
        maxl2fc: '',
        minl2fc: '',
        fun_for_l2fc: 'geom_mean',
        showpval: true,
        showroundedpval: true,
        showl2fc: true,
        assay_for_matrix: 'BaseCounts',
        normalization: 'relabund',
        asPPM: true,
        scaled: false,
        cdict: '',
        maxnumheatmaps: '',
        numthreads: 1,
        statsonlog: false,
        ignoreunclassified: true,
        returnstats: false,
        class_to_ignore: 'N_A'
    });

    const displayNames = {
        glomby: 'Glom By',
        hmtype: 'Heatmap Type',
        samplesToKeep: 'Samples to Keep',
        featuresToKeep: 'Features to Keep',
        applyfilters: 'Apply Filters',
        featcutoff: 'Feature Cutoff',
        GenomeCompletenessCutoff: 'Genome Completeness Cutoff',
        PPM_normalize_to_bases_sequenced: 'PPM Normalize to Bases Sequenced',
        subsetby: 'Subset By',
        compareby: 'Compare By',
        invertbinaryorder: 'Invert Binary Order',
        showonlypbelow: 'Show Only P Below',
        adj_pval_for_threshold: 'Adjust P-Value for Threshold',
        ntop: 'N Top',
        colcategories: 'Column Categories',
        splitcolsby: 'Split Columns By',
        ordercolsby: 'Order Columns By',
        textby: 'Text By',
        cluster_samples_per_heatmap: 'Cluster Samples per Heatmap',
        cluster_features_per_heatmap: 'Cluster Features per Heatmap',
        label_samples: 'Label Samples',
        cluster_rows: 'Cluster Rows',
        max_rows_in_heatmap: 'Max Rows in Heatmap',
        no_underscores: 'No Underscores',
        showGram: 'Show Gram',
        show_GenomeCompleteness: 'Show Genome Completeness',
        addtit: 'Add Title',
        hmasPA: 'Heatmap as PA',
        threshPA: 'Threshold PA',
        cluster_column_slices: 'Cluster Column Slices',
        column_split_group_order: 'Column Split Group Order',
        row_order: 'Row Order',
        discard_SDoverMean_below: 'Discard SD over Mean Below',
        maxl2fc: 'Max L2FC',
        minl2fc: 'Min L2FC',
        fun_for_l2fc: 'Function for L2FC',
        showpval: 'Show P-Value',
        showroundedpval: 'Show Rounded P-Value',
        showl2fc: 'Show L2FC',
        assay_for_matrix: 'Assay for Matrix',
        normalization: 'Normalization',
        asPPM: 'As PPM',
        scaled: 'Scaled',
        cdict: 'Color Dictionary',
        maxnumheatmaps: 'Max Number of Heatmaps',
        numthreads: 'Number of Threads',
        statsonlog: 'Stats on Log',
        ignoreunclassified: 'Ignore Unclassified',
        returnstats: 'Return Stats',
        class_to_ignore: 'Class to Ignore'
    };

    const [heatmapData, setHeatmapData] = useState(null);
    const [objects, setObjects] = useState([]); // for ExpObj dropdown
    const [filePath, setFilePath] = useState('');
    const [selectedObj, setSelectedObj] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatingHeatmap, setGeneratingHeatmap] = useState(false);

    const resultRef = useRef(null);
    const loadingRef = useRef(null);

    // auto scroll to results when they are ready
    useAutoScroll(heatmapData, resultRef);
    useAutoScroll(generatingHeatmap, loadingRef);

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
            setLoading(true); // Start loading circle
            setGeneratingHeatmap(true);
            // Combine the parameters with selected objects and file path
            const params = {
                filePath,
                ExpObj: selectedObj,
                advancedSettings: {},
                ...parameters
            };
            // Call IPC method to run the heatmap script
            const result = await window.electron.runHeatmapScript(params);
            // Update the heatmap data with result
            setHeatmapData(result);
        } catch (error) {
            console.error('Error generating heatmap:', error);
            setWarningMessage(`Error: ${error.message || 'Failed to generate heatmap'}`);
            setShowWarning(true);
        } finally {
            setLoading(false); // End loading circle regardless of success or failure
            setGeneratingHeatmap(false);
        }
    };

    const handleFileUpload = async () => {
        try {
            setLoading(true); // start loading
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
            setLoading(false); // end loading
        }
    };

    const handleObjSelect = (e) => {
        const value = e.target.value;
        setSelectedObj(value);
        console.log('Selected object state:', value);
    };

    const handleDownloadClick = () => {
        // Send IPC event to open the heatmap PDF
        window.electron.send('open-heatmap-location');
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


            <h1>Generate Heatmap</h1>
            <div>
                {/* File upload for RData file */}
                <h3>Upload R Data File for Heatmap</h3>
                <Button
                    component="label"
                    variant='contained'
                    startIcon={<CloudUploadIcon />}
                    onClick={handleFileUpload}
                    disabled={loading}
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

            {/* Form for Heatmap Parameters */}
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
                        ) : typeof parameters[key] === 'boolean' ? (
                            <input
                                type='checkbox'
                                id={key}
                                name={key}
                                checked={parameters[key]}
                                onChange={handleChange}
                                />
                        ): (
                            <input
                                type="text"
                                id={key}
                                name={key}
                                value={parameters[key]}
                                onChange={handleChange}
                            />
                        )}
                    </div>
                ))}
                <Button type='submit' variant='outlined' color='primary' disabled={loading}>
                    Generate Heatmap
                </Button>
            </form>

            {/* Add loading indicator */}
            {loading && <LoadingIndicator ref={generatingHeatmap ? loadingRef : null} />}

            {heatmapData && !loading && (
                <div id='heatmap-container' ref={resultRef}>
                    <h2>Heatmap</h2>
                    <Button
                        variant='contained'
                        color='primary'
                        onClick={handleDownloadClick}
                    >
                        Open Heatmap PDF
                    </Button>
                </div>
            )}
        </div>
    );
};

export default Heatmap;
