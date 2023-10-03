import DataGrid from '@/ui/components/DataGrid';
import { Radio } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import React from 'react'
import { Tune } from '../types';

interface RecentlyPracticedType {
  tunes: Tune[]
}

export default function RecentlyPracticed({tunes}: RecentlyPracticedType) {
  const recentlyPracticedColumns: GridColDef[] = [

    {
        field: 'title',
        headerName: 'Tune Name',
        width: 300,
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
        field: 'easiness',
        headerName: 'Ease',
        width: 150,
      },

  ];
  return (
    <>
    <h4>Most recent tunes practiced:</h4>
    <DataGrid rows={tunes} columns={recentlyPracticedColumns} pageSize={10} rowClickAction={() => console.log("you clicked me")} />
    </>
  )
}
