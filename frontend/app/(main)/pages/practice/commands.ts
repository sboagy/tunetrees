"use server";

import axios from "axios";

const baseURL = process.env.TT_API_BASE_URL;

interface IPracticeFeedbackProps {
  id: number;
  feedback: string;
  user_id: string;
  playlist_id: string;
}

// DEADCODE: Dead code?
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
  playlistId: number;
  updates: { [key: string]: ITuneUpdate };
}

export const submitPracticeFeedbacks = async ({
  playlistId,
  updates,
}: IPracticeFeedbacksProps): Promise<string> => {
  if (!baseURL) {
    console.error("Base URL is not defined");
    return "Error: Base URL is not defined";
  }
  const url = `${baseURL}/practice/submit_feedbacks`;
  console.log(
    `Submitting feedbacks for user_id: ${playlistId}, updates: ${JSON.stringify(updates)} url: ${url}`,
  );

  try {
    const reviewSitdownDate = process.env.TT_REVIEW_SITDOWN_DATE;
    const response = await axios({
      method: "post",
      url: `${baseURL}/practice/submit_feedbacks/${playlistId}`,
      data: updates,
      params: {
        sitdown_date: reviewSitdownDate,
      },
      headers: {
        key: "Access-Control-Allow-Origin",
        Accept: "application/json",
        // "Content-Type": "application/x-www-form-urlencoded",
        "Content-Type": "application/json",
      },
    });
    console.log("Feedbacks submitted successfully:", response.data);
    return response.data as string;
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

export interface ITuneScheduleUpdate {
  review_date: string;
}

interface IPracticeSchedulesProps {
  playlist_id: string;
  updates: { [key: string]: ITuneScheduleUpdate };
}

// DEADCODE: Dead code?
export const submitPracticeSchedules = async ({
  playlist_id,
  updates,
}: IPracticeSchedulesProps): Promise<string> => {
  if (!baseURL) {
    console.error("Base URL is not defined");
    return "Error: Base URL is not defined";
  }
  const url = `${baseURL}/practice/submit_schedules`;
  console.log(
    `Submitting feedbacks for user_id: ${playlist_id}, updates: ${JSON.stringify(updates)} url: ${url}`,
  );

  try {
    const response = await axios({
      method: "post",
      url: `${baseURL}/practice/submit_schedules/${playlist_id}`,
      data: updates,
      headers: {
        key: "Access-Control-Allow-Origin",
        Accept: "application/json",
        // "Content-Type": "application/x-www-form-urlencoded",
        "Content-Type": "application/json",
      },
    });
    console.log("Schedules submitted successfully:", response.data);
    return response.data as string;
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
