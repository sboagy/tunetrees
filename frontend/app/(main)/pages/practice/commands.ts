"use server";

import { convertToPythonUTCString } from "@/lib/date-utils";
import axios from "axios";

const baseURL = process.env.TT_API_BASE_URL;

if (!baseURL) {
  console.error(
    "TT_API_BASE_URL environment variable is not set in commands.ts!",
  );
  throw new Error("TT_API_BASE_URL environment variable is not set");
}

console.log("Commands API baseURL:", baseURL);

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
      url: `${baseURL}/tunetrees/practice/submit_feedback`,
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

  sitdownDate: Date;
}

export const submitPracticeFeedbacks = async (
  props: IPracticeFeedbacksProps,
): Promise<string> => {
  const { playlistId, updates, sitdownDate } = props;
  if (!baseURL) {
    console.error("Base URL is not defined");
    return "Error: Base URL is not defined";
  }
  const url = `${baseURL}/tunetrees/practice/submit_feedbacks`;
  console.log(
    `Submitting feedbacks for user_id: ${playlistId}, updates: ${JSON.stringify(updates)} url: ${url}`,
  );

  try {
    if (
      !sitdownDate ||
      !(sitdownDate instanceof Date) ||
      Number.isNaN(sitdownDate.getTime())
    ) {
      throw new Error(
        "A valid sitdownDate (Date object) must be provided to submitPracticeFeedbacks.",
      );
    }
    const response = await axios({
      method: "post",
      url: `${url}/${playlistId}`,
      data: updates,
      params: {
        sitdown_date: convertToPythonUTCString(sitdownDate.toISOString()),
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
  const url = `${baseURL}/tunetrees/practice/submit_schedules`;
  console.log(
    `Submitting feedbacks for user_id: ${playlist_id}, updates: ${JSON.stringify(updates)} url: ${url}`,
  );

  try {
    const response = await axios({
      method: "post",
      url: `${baseURL}/tunetrees/practice/submit_schedules/${playlist_id}`,
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
