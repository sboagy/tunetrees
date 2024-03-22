'use client'
import axios from 'axios';

const baseURL = "http://127.0.0.1:8000/tunetrees" 


interface PracticeFeedbackProps {
    id: number
    feedback: string
}

export const submitPracticeFeedback = async ({id, feedback}: PracticeFeedbackProps) => {

    try {
        
        axios({
            method: 'post',
            url: `${baseURL}/practice/feedback`,
            data: {selected_tune: id, vote_type: feedback},
            headers: {
                'key': 'Access-Control-Allow-Origin',
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
        })
        .then(response => {
            console.log(response);
        })
        .catch(error => {
            console.error(error);
        });
    }
    catch(e: any) {
        console.log("Unable to post feedback.")
    }
}