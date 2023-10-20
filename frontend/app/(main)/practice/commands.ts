import axios from 'axios';

const client = axios.create({
    baseURL: "http://127.0.0.1:8000/tunetrees" 
  });

interface PracticeFeedbackProps {
    id: string
    feedback: string
}

export const submitPracticeFeedback = async ({id, feedback}: PracticeFeedbackProps) => {
    try {
        const stringified = JSON.stringify({
            selected_tune: id, vote_type: feedback
        })

        await client.post("/practice/feedback", {body: stringified})
    }
    catch(e: any) {
        console.log("Unable to post feedback.")
    }
}