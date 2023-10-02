const BASE_URL = "http://127.0.0.1:8000"

export const getPracticeListScheduled = async () => {
    let response = await fetch(`${BASE_URL}/tunetrees/get_practice_list_scheduled`)
    let data = await response.json()
    return data
}