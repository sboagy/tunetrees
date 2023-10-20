import React from 'react'
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { Form, Formik, FormikProps } from 'formik';
import * as Yup from "yup";

interface Values {
    id: string
    feedback: string
  }

export default function RecallEvaluationForm({tuneId}) {

    const initialValues = {
        id: '',
        feedback: ''
      }

    const TunePracticeFeedbackSchema = Yup.object().shape({
        id: Yup.string().required(),
        feedback: Yup.string().required()
      })

  return (
    <Formik
                initialValues={initialValues}
                validationSchema={TunePracticeFeedbackSchema}
                onSubmit={(values) => console.log(values)}
              >
                {({ values, handleBlur, setFieldValue }: FormikProps<Values>) => {
                  tuneId !== values.id && setFieldValue("id", tuneId)
                  return (
                    <Form>
                      <Box sx={{display: "flex", flexDirection: "column"}}>  
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
                      </Box>
              
                    </Form>
                  );
                }}
                  </Formik>
  )
}
