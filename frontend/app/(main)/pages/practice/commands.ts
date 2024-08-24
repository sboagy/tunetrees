"use server";

import axios from "axios";
import { string } from "zod";

const baseURL = process.env.TT_API_BASE_URL;

interface PracticeFeedbackProps {
  id: number;
  feedback: string;
  user_id: string;
  playlist_id: string;
}

export const submitPracticeFeedback = async ({
  id,
  feedback,
  user_id,
  playlist_id,
}: PracticeFeedbackProps): Promise<void> => {
  if (!baseURL) {
    console.error("Base URL is not defined");
    return;
  }
  console.log(
    "Submitting feedback for for user_id, playlist_id:",
    user_id,
    playlist_id,
  );

  try {
    const response = await axios({
      method: "post",
      url: `${baseURL}/practice/submit_feedback`,
      data: {
        selected_tune: id,
        vote_type: feedback,
        user_id: user_id,
        playlist_id: playlist_id,
      },
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
