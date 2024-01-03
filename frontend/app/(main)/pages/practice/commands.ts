import axios from 'axios';

const client = axios.create({
    baseURL: "http://127.0.0.1:8000/tunetrees" 
  });

interface PracticeFeedbackProps {
    id: number
    feedback: string
}

export const submitPracticeFeedback = async ({id, feedback}: PracticeFeedbackProps) => {
    try {
        const stringified = JSON.stringify({
            selected_tune: id, vote_type: feedback
        })

        axios({
            method: 'post',
            url: '/practice/feedback',
            data: stringified,
            headers: {
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