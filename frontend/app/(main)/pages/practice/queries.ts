import axios from 'axios';

const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_TT_BASE_URL
    // baseURL: "http://tunetrees.com:3000"
    // baseURL: "http://server:8000/tunetrees"
    // baseURL: "http://localhost:8000/tunetrees"
    // baseURL: "http://tunetrees.com:8000/tunetrees"
});

//Possibly need a mapper here too! Not sure what the convention is for things like variable case when moving between languages
export const getPracticeListScheduled = async () => {
    try {
        console.log('In getPracticeListScheduled: baseURL: %s', client.getUri())
        let response = await client.get(`/get_practice_list_scheduled`)
        let data = await response.data
        console.log('data in query', data)
        return data
    }
    catch (e: any) {
        console.log(e.console.error())
    }
}

export const getRecentlyPracticed = async () => {
    try {
        let response = await client.get(`/get_tunes_recently_played`)
        let data = await response.data
        return data
    }
    catch (e: any) {
        console.log(e.console.error())
    }
}