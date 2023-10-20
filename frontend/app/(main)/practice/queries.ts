import axios from 'axios';

const client = axios.create({
    baseURL: "http://127.0.0.1:8000/tunetrees" 
  });

//Possibly need a mapper here too! Not sure what the convention is for things like variable case when moving between languages
export const getPracticeListScheduled = async () => {
    try {
        let response = await client.get(`/get_practice_list_scheduled`)
        let data = await response.data
        return data
    }
    catch(e: any) {
        console.log(e.console.error())
    }
}

export const getRecentlyPracticed = async () => {
    try {
        let response = await client.get(`/get_tunes_recently_played`)
        let data = await response.data
        return data
    }
    catch(e: any) {
        console.log(e.console.error())
    }
}