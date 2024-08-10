import * as React from 'react';
import Box from '@mui/material/Box';
import {DataGrid as MUIDataGrid, gridClasses} from '@mui/x-data-grid';

//TODO fix any to real types!!!!
interface DataGridType {
    rows: any
    columns: any
    pageSize: number 
    rowClick?: any
}

// TODO: #49 Refactor DataGrid to use radix-ui/shadcn-ui
export default function DataGrid({rows, columns, pageSize=10, rowClick}: DataGridType) {


  return (
    <Box sx={{height: pageSize*64}}>
      <MUIDataGrid
        rows={rows}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: pageSize,
            },
          },
        }}
        sx={{
          [`& .${gridClasses.cell}:focus, & .${gridClasses.cell}:focus-within`]: {
            outline: 'none',
          },
          [`& .${gridClasses.columnHeader}:focus, & .${gridClasses.columnHeader}:focus-within`]:
            {
              outline: 'none',
            },
        }}
        pageSizeOptions={[pageSize]}
        hideFooterSelectedRowCount
        onRowClick={rowClick}
      />
    </Box>
  );
}