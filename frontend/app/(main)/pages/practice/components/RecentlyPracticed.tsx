import DataGrid from '@/ui/components/DataGrid';
import { Radio } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React from 'react'
import { Tune } from '../types';

interface RecentlyPracticedType {
  tunes: Tune[]
}

export default function RecentlyPracticed({tunes}: RecentlyPracticedType) {
  const recentlyPracticedColumns: GridColDef[] = [

    {
      field: 'externalLink',
      headerName: 'External Link',
      width: 160,
      renderCell: (params: GridRenderCellParams) => {
        return <a href={`https://www.irishtune.info/tune/${params.row.id}`} target="_blank">{params.row.title}</a>
      }
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
