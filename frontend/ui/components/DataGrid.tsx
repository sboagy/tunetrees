import * as React from 'react';
import Box from '@mui/material/Box';
import { DataGrid as MUIDataGrid } from '@mui/x-data-grid';

//TODO fix any to real type
interface DataGridType {
    rows: any
    columns: any
    pageSize: number 
}

export default function DataGrid({rows, columns, pageSize=10}: DataGridType) {

  return (
    <Box sx={{ height: pageSize*64, width: '100%' }}>
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
        pageSizeOptions={[pageSize]}
        checkboxSelection
        disableRowSelectionOnClick
        hideFooterSelectedRowCount
      />
    </Box>
  );
}