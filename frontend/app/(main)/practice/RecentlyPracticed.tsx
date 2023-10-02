import DataGrid from '@/ui/components/DataGrid';
import { GridColDef } from '@mui/x-data-grid';
import React from 'react'

export default function RecentlyPracticed({tunes}: any) {
  const recentlyPracticedColumns: GridColDef[] = [
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
        field: 'easiness',
        headerName: 'Ease',
        width: 150,
      },

  ];
  return (
    <>
    <h4>Most recent tunes practiced:</h4>
    <DataGrid rows={tunes} columns={recentlyPracticedColumns} pageSize={10} />
    </>
  )
}
