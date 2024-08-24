import axios from "axios";

const client = axios.create({
  // baseURL: process.env.TT_API_BASE_URL
  baseURL: process.env.NEXT_PUBLIC_TT_BASE_URL,
  // baseURL: "http://tunetrees.com:3000"
  // baseURL: "http://server:8000/tunetrees"
  // baseURL: "http://localhost:8000/tunetrees"
  // baseURL: "http://tunetrees.com:8000/tunetrees"
});

//Possibly need a mapper here too! Not sure what the convention is for things like variable case when moving between languages
export const getPracticeListScheduled = async (
  user_id: string,
  playlist_id: string,
) => {
  try {
    console.log("In getPracticeListScheduled: baseURL: %s", client.getUri());
    console.log("user_id: %s, playlist_id: %s", user_id, playlist_id);
    const response = await client.get(
      `/get_practice_list_scheduled/${user_id}/${playlist_id}`,
    );
    const data = await response.data;
    // console.log('data in query', data)
    return data;
  } catch (e) {
    console.log(console.error());
  }
};

export const getRecentlyPracticed = async (
  user_id: string,
  playlist_id: string,
) => {
  try {
    const response = await client.get(
      `/get_tunes_recently_played/${user_id}/${playlist_id}`,
    );
    const data = await response.data;
    return data;
  } catch (e) {
    console.log(console.error());
  }
};
