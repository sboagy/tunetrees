"use server";

import axios from "axios";

const baseURL = process.env.TT_API_BASE_URL;

interface PracticeFeedbackProps {
  id: number;
  feedback: string;
}

export const submitPracticeFeedback = async ({
  id,
  feedback,
}: PracticeFeedbackProps): Promise<void> => {
  if (!baseURL) {
    console.error("Base URL is not defined");
    return;
  }

  try {
    const response = await axios({
      method: "post",
      url: `${baseURL}/practice/submit_feedback`,
      data: { selected_tune: id, vote_type: feedback },
      headers: {
        key: "Access-Control-Allow-Origin",
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    console.log("Feedback submitted successfully:", response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Axios error:", error.response?.data || error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  }
};
