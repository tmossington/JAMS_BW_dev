import React, {useEffect, useState, useRef } from 'react';
import { Box, Typography, Button, Paper, Grid, TextField, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
const electron = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

const Workflows = ({ handleNavigateTo }) => {
    const [workflows, setWorkflows] = useState([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

    // get user data path for storing workflows
    const getUserDataPath = () => {
        return electron.remote ? electron.remote.app.getPath('userData') : electron.app.getPath('userData');
    };

    const workflowsDir = path.join(getUserDataPath(), 'workflows');
    const workflowsIndexPath = path.join(workflowsDir, 'index.json');

    // Create directories if they are absent
    useEffect(() => {
        try {
            if (!fs.existsSync(workflowsDir)) {
                fs.mkdirSync(workflowsDir, { recursive: true });
            }
            if (!fs.existsSync(workflowsIndexPath)) {
                fs.writeFileSync(workflowsIndexPath, JSON.stringify([]), 'utf8');
            }
            loadWorkflows();
        } catch (error) {
            console.error('Error initializing workflow storage:', error);
            setWorkflows([]);
        }
    });

    // Save workflow index
    const saveWorkflowsIndex = (updatedWorkflows) => {
        try {
            fs.writeFileSync(workflowsIndexPath, JSON.stringify(updatedWorkflows, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving workflows index:', error);
        }
    };





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

            <h1>Saved Workflows</h1>
            <p>Pardon our Dust!</p>
        </div>
    );
};

export default Workflows;
