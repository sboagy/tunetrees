import axios from 'axios';

const BASE_URL = "http://127.0.0.1:8000"

//Possibly need a mapper here too! Not sure what the convention is for things like variable case when moving between languages
export const getPracticeListScheduled = async () => {
    let response = await axios.get(`${BASE_URL}/tunetrees/get_practice_list_scheduled`)
    let data = await response.data
    return data
}

export const getRecentlyPracticed = async () => {
    let response = await axios.get(`${BASE_URL}/tunetrees/get_tunes_recently_played`)
    let data = await response.data
    return data
}