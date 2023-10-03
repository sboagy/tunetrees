import React, { useState } from 'react'
import { GridColDef, GridEventListener } from '@mui/x-data-grid';
import DataGrid from '@/ui/components/DataGrid';
import { Tune } from '../types';
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { Form, Formik, FormikProps } from 'formik';
import * as Yup from "yup";


interface ScheduledTunesType {
  tunes: Tune[]
}

interface Values {
  id: string
  feedback: string
}



export default function ScheduledTunes({tunes}: ScheduledTunesType) {

    const [selectedTune, setSelectedTune] = useState<Tune>()

    const TunePracticeFeedbackSchema = Yup.object().shape({
      id: Yup.string().required(),
      feedback: Yup.string().required()
    })
  
    const scheduledTunesColumns: GridColDef[] = [
        {
            field: 'title',
            headerName: 'Tune Name',
            width: 250,
        },
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
      ]

      const handleRowClick: GridEventListener<'rowClick'> = (
        params
      ) => {
        if (selectedTune && selectedTune.id === params.id) {
          setSelectedTune(undefined)
          return
        }
        setSelectedTune(params.row)
      }

      const handleSubmit = (values: Values) => {
        console.log(values)
        //TODO - add submission confirmation
        //TODO - remove tune from scheduled practice list and move to recently practiced
      }
      
      const initialValues = {
        id: '',
        feedback: ''
      }

  

      return (
        <>
        <h4>Scheduled for practice:</h4>
        {selectedTune && 
          <Box sx={{border: 1, height: "30vh", my: 4, display: "flex", justifyContent: "center", alignItems: "center"}}>
            <Box sx={{width: "98%"}}>
              <Formik
                initialValues={initialValues}
                validationSchema={TunePracticeFeedbackSchema}
                onSubmit={(values) => handleSubmit(values)}
              >
                {({ values, handleBlur, setFieldValue }: FormikProps<Values>) => {
                  const tuneId = selectedTune.id.toString()
                  tuneId !== values.id && setFieldValue("id", tuneId)
                  return (
                    <Form>
                      <Box sx={{display: "flex", flexDirection: "column"}}>  
                      <Box sx={{mt: 4}}>Current Tune: {selectedTune.title}</Box>
                      <Box sx={{my: 4}}>Last Practiced: {selectedTune.practiced}</Box>
                      <FormControl>  
                          <InputLabel id="feedback" sx={{backgroundColor: "white"}}>
                              <Box >
                                Choose Recall Evaluation
                              </Box>
                            </InputLabel>
                          <Select
                            id="feedback"
                            name="feedback"
                            value={values.feedback}
                            onBlur={handleBlur}
                            onChange={(e) => setFieldValue('feedback', e.target.value as string)}
                            sx={{width: "50%"}}
                            label="Choose Recall Evaluation"
                            >
                              <MenuItem value="failed">Failed (no recall)</MenuItem>
                              <MenuItem value="barely">Barely Remembered Some (perhaps A part but not B part)</MenuItem>
                              <MenuItem value="struggled">Remembered with Some Mistakes (and needed verification)</MenuItem>
                              <MenuItem value="recalled">Recalled with Some Work (but without help)</MenuItem>
                              <MenuItem value="trivial">Not Bad (but maybe not session ready)</MenuItem>
                              <MenuItem value="perfect">Good (could perform solo or lead in session)</MenuItem>
                          </Select>
                        </FormControl>   
                        <Button variant="outlined" type="submit" sx={{my: 4, width: "10%" }}>
                          Submit
                        </Button>
                      </Box>
              
                    </Form>
                  );
                }}
                  </Formik>
                </Box>
              </Box>}
            <DataGrid rows={tunes} columns={scheduledTunesColumns} pageSize={10} rowClick={handleRowClick} />

            </>

          )
}
