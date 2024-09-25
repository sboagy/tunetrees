"use server";

import axios from "axios";

const baseURL = process.env.TT_API_BASE_URL;

interface IPracticeFeedbackProps {
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
}: IPracticeFeedbackProps): Promise<void> => {
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

export interface ITuneUpdate {
  feedback: string;
}

interface IPracticeFeedbacksProps {
  playlist_id: string;
  updates: { [key: string]: ITuneUpdate };
}

export const submitPracticeFeedbacks = async ({
  playlist_id,
  updates,
}: IPracticeFeedbacksProps): Promise<string> => {
  if (!baseURL) {
    console.error("Base URL is not defined");
    return "Error: Base URL is not defined";
  }
  const url = `${baseURL}/practice/submit_feedbacks`;
  console.log(
    `Submitting feedbacks for user_id: ${playlist_id}, updates: ${updates} url: ${url}`,
  );

  try {
    const response = await axios({
      method: "post",
      url: `${baseURL}/practice/submit_feedbacks/${playlist_id}`,
      data: updates,
      headers: {
        key: "Access-Control-Allow-Origin",
        Accept: "application/json",
        // "Content-Type": "application/x-www-form-urlencoded",
        "Content-Type": "application/json",
      },
    });
    console.log("Feedbacks submitted successfully:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Axios error:", error.response?.data || error.message);
    } else {
      console.error("Unexpected error:", error);
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "Error: An unknown error occurred";
  }
};
