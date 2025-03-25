import React, {useEffect, useState, useRef } from 'react';
import { Box, Typography, Button, Paper, Grid } from '@mui/material';

const Workflows = ({ handleNavigateTo }) => {
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
