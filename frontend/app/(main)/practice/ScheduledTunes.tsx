import React from 'react'
import { GridColDef } from '@mui/x-data-grid';
import DataGrid from '@/ui/components/DataGrid';

//TODO why is my type so cranky here
export default function ScheduledTunes({tunes}: any) {
    console.log(tunes)

    const scheduledTunesColumns: GridColDef[] = [
        {
            field: 'title',
            headerName: 'Tune Name',
            width: 150,
        },
        { 
            field: 'id', 
            headerName: 'ID', 
            width: 90 },
        {
            field: 'type',
            headerName: 'Type',
            width: 150,
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
            width: 150,
          },
      ];
      

  return (
    <DataGrid rows={tunes} columns={scheduledTunesColumns} pageSize={10} />

  )
}
