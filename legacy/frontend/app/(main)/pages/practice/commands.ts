"use server";

import axios from "axios";
import { convertToPythonUTCString } from "@/lib/date-utils";

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

// New lightweight single-tune staging submit (stage=true). Optimistic UI updates should occur before calling.
export const stagePracticeFeedback = async (
  playlistId: number,
  tuneId: number,
  feedback: string,
  sitdownDate: Date,
  goal: string | null = null,
): Promise<boolean> => {
  try {
    if (!baseURL) return false;
    if (!sitdownDate || Number.isNaN(sitdownDate.getTime())) return false;
    const url = `${baseURL}/tunetrees/practice/submit_feedbacks/${playlistId}`;
    const body: Record<string, ITuneUpdate> = {
      [String(tuneId)]: { feedback, goal },
    };
    await axios({
      method: "post",
      url,
      data: body,
      params: {
        sitdown_date: convertToPythonUTCString(sitdownDate.toISOString()),
        stage: true,
      },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    return true;
  } catch (error) {
    console.error("stagePracticeFeedback error", error);
    return false;
  }
};

// Clear (delete) staged feedback/evaluation for a single tune (if supported by backend).
// Fallback: return false if API not present (caller will still clear locally).
export const clearStagedPracticeFeedback = async (
  playlistId: number,
  tuneId: number,
): Promise<boolean> => {
  try {
    if (!baseURL) return false;
    // Assuming backend exposes DELETE /tunetrees/practice/staged/{playlistId}/{tuneId}
    const url = `${baseURL}/tunetrees/practice/staged/${playlistId}/${tuneId}`;
    await axios.delete(url, { headers: { Accept: "application/json" } });
    return true;
  } catch (error) {
    console.warn("clearStagedPracticeFeedback error (non-fatal)", error);
    return false;
  }
};

// Commit all staged feedbacks for a playlist.
export const commitStagedPractice = async (
  playlistId: number,
): Promise<{ status: string; count?: number } | null> => {
  try {
    if (!baseURL) return null;
    const url = `${baseURL}/tunetrees/practice/commit_staged/${playlistId}`;
    const resp = await axios.post(url, undefined, {
      headers: { Accept: "application/json" },
    });
    return resp.data as { status: string; count?: number };
  } catch (error) {
    console.error("commitStagedPractice error", error);
    return null;
  }
};

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
  goal?: string | null;
}

interface IPracticeFeedbacksProps {
  playlistId: number;
  updates: { [key: string]: ITuneUpdate };

  sitdownDate: Date;
}

interface ISubmitFeedbacksResponse {
  status: string;
  staged?: boolean;
  count?: number;
  [k: string]: unknown;
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
    const data = response.data as ISubmitFeedbacksResponse | string;
    if (typeof data === "string") {
      console.log("Feedbacks submitted (string response):", data);
      return data;
    }
    console.log("Feedbacks submitted successfully:", data);
    return data.status || "ok";
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
  due: string;
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
