import React, { useState } from 'react'
import { GridColDef, GridEventListener, GridRenderCellParams } from '@mui/x-data-grid';
import DataGrid from '@/ui/components/DataGrid';
import { Tune } from '../types';

import { submitPracticeFeedback } from '../commands';
import RecallEvaluationForm from './RecallEvaluationForm';
import { Box, Button } from '@mui/material';


interface ScheduledTunesType {
  tunes: Tune[]
}



export default function ScheduledTunes({tunes}: ScheduledTunesType) {

  const handleSubmit = (values: Values) => {
    console.log(values)
    const {id, feedback} = values
    const idInt = parseInt(id)
    submitPracticeFeedback({id, feedback})
  }


    const scheduledTunesColumns: GridColDef[] = [
        {
            field: 'title',
            headerName: 'Tune Name',
            width: 250,
        },
        {
            field: 'type',
            headerName: 'Type',
            width: 100,
        },
        {
            field: 'practiced',
            headerName: 'Last Practiced',
            width: 150,
        },
        {
            field: 'review_date',
            headerName: 'Scheduled',
            width: 150,
          },
          {
            field: 'note_private',
            headerName: 'Note Private',
            width: 150,
          },
          {
            field: 'note_public',
            headerName: 'Note Public',
            width: 150,
          },
          {
            field: 'tags',
            headerName: 'Tags',
            width: 90,
          },
          {
            field: 'incipit', 
            headerName: 'Incipit',
            width: 150
          },
          {
            field: 'externalLink',
            headerName: 'External Link',
            width: 160,
            renderCell: (params: GridRenderCellParams) => {
              return <a href={`https://www.irishtune.info/tune/${params.row.id}`} target="_blank">{params.row.title}</a>
            }
          },
          {
              field: 'recallEval',
              headerName: 'Recall Evaluation',
              width: 500,
              renderCell: (params: GridRenderCellParams) => {
                return <Box sx={{width: "100%"}}><RecallEvaluationForm tuneId={params.row.id}/></Box>
              }
            },
          
      ]

 
      //So I think Formik can take each tune and add it to an array, and then we'll have the submit button send the array to the backend
      //We'll need to update the backend api to take an array of tunes vs. the singular tune
   

      return (
        <>
          <h4>Scheduled for practice:</h4>
          <DataGrid rows={tunes} columns={scheduledTunesColumns} pageSize={10} />
          <Button>Submit Practiced Tunes</Button>

        </>

          )
}
