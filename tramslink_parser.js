
import promptSync from "prompt-sync";
const prompt = promptSync({
    sigint: false
});
import fetch from "node-fetch";
import fs from "fs/promises";


// TODO
// [x] Input validations
// [x] Fetch all three endpoints
// [x] Caching for tripUpdates raw data
// [x] Caching for vehiclePositions raw data
// [x] Caching for alerts raw data
// [x] Read & Write for tripUpdates raw data
// [x] Read & Write for vehiclePositions raw data
// [x] Read & Write for alerts raw data
// [ ] Update cache by the timestamp (every 10 minutes)
// [ ] Combine only filtered data
// [ ] Show filtered data

// Endpoints
const TRIP_UPDATES_URL = 'http://127.0.0.1:5343/gtfs/seq/trip_updates.json';
const VEHICLE_POSITIONS_URL = 'http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json';
const ALERTS_URL = 'http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json';

// Global messages
const GREETING_MESSAGE = "Welcome to the UQ Lakes station bus tracker!";
const DATE_PROMPT = "What date will you depart UQ Lakes station by bus? ";
const TIME_PROMPT = "What time will you depart UQ Lakes station by bus? ";
const GOODBYE_MESSAGE = "Thanks for using the UQ Lakes station bus tracker!"
const QUIT_APP_PROMPT = "Would you like to search again? "
const INVALID_DATE_MESSAGE = 'Please input a valid date!'

// Paths
const CACHE_DATA_PATH = './cached_data'
const STATIC_DATA_PATH = './static_data'
const TRIP_UPDATES_FILENAME = `${CACHE_DATA_PATH}/tripUpdates.json`
const VEHICLE_POSITIONS_FILENAME = `${CACHE_DATA_PATH}/vehiclePositions.json`
const ALERTS_FILENAME = `${CACHE_DATA_PATH}/alerts.json`



async function main() {


    /**
    * This function will validate whether the cache is expired or not
    * @param {number} date - The string to append to the JSON filename.
    * @param {number} time - The string to append to the JSON filename.
    * @returns {bool} true if not expired
    */
    function isValidDateTime(date, time) {
        // Check if date and time are number and is correctly formatted
        if (isNaN(date) && !date.includes('-') || isNaN(time) && !time.includes(':')) return false

        // Convert Date and Time input to validate using Date.parse(yyyy-mm-ddThh:mm)
        const tempDateTimeAppended = date + 'T' + time + ':00';

        // Validate Date and Time input using Date.parse()
        return !isNaN(Date.parse(tempDateTimeAppended));
    }

    /**
    * This function will validate whether the cache is expired or not
    * @param {number} dataTimestamp - The string to append to the JSON filename.
    * @returns {bool} true if not expired
    */
    function validateCache(dataTimestamp) {
        let currentDateTime = new Date()
        console.log(currentDateTime)
        return currentDateTime < 600000

    }

    async function fetchData(url) {
        const response = await fetch(url)
        return response.json();
    }

    async function processData(dateTime) {
        console.log("loading...")

        let tripUpdates;
        let vehiclePositions;
        let alerts;
        let mergedData = []

        let tripUpdatesCached = await readCache(TRIP_UPDATES_FILENAME)
        let vehiclePositionsCached = await readCache(VEHICLE_POSITIONS_FILENAME)
        let alertsCached = await readCache(ALERTS_FILENAME)


        // TODO
        // Validate cache timestamp
        // Load from cache else fetch from API
        if (tripUpdatesCached && vehiclePositionsCached && alertsCached) {
            console.log('data from cache...')
            console.log(JSON.parse(tripUpdatesCached))
            console.log(JSON.parse(vehiclePositionsCached))
            console.log(JSON.parse(alertsCached))
        } else {
            // Fetch all data from API
            // Fetch trip updates data
            await fetchData(TRIP_UPDATES_URL)
                .then(res => {
                    tripUpdates = res.entity;
                    console.log(tripUpdates);
                    saveCache(TRIP_UPDATES_FILENAME, res)
                }).catch(e => console.log(e))

            // Fetch vehicle positions data
            await fetchData(VEHICLE_POSITIONS_URL)
                .then(res => {
                    vehiclePositions = res.entity;
                    console.log(vehiclePositions);
                    saveCache(VEHICLE_POSITIONS_FILENAME, res)
                }).catch(e => console.log(e))

            // Fetch alerts data
            await fetchData(ALERTS_URL)
                .then(res => {
                    alerts = res.entity;
                    console.log(alerts);
                    saveCache(ALERTS_FILENAME, res)
                }).catch(e => console.log(e))
        }

        return mergedData;
    }

    async function saveCache(filename, data) {
        try {
            await fs.writeFile(filename, JSON.stringify(data))
            console.log('writing to cache')
        } catch (error) {
            console.log(error)
        }
    }

    async function readCache(filename) {
        try {
            const data = await fs.readFile(filename);
            console.log('reading from cache')
            return data;
        } catch (error) {
            console.log(error)
        }
    }

    let isSearchAgain = null
    while (true) {

        // Show greeting
        console.log(GREETING_MESSAGE)

        // Obtain user input and validate it
        while (true) {
            // Prompt "What date will you depart UQ Lakes station by bus?"
            const dateInput = prompt(DATE_PROMPT)

            // Prompt "What time will you depart UQ Lakes station by bus?"
            const timeInput = prompt(TIME_PROMPT)

            if (isValidDateTime(dateInput, timeInput)) {
                console.log("valid date")
                break;
            }
            console.log(INVALID_DATE_MESSAGE)
        }

        await processData(12)
            .then(res => {
                // console.log(res)
                // Prompt "Would you like to search again?"
                isSearchAgain = prompt(QUIT_APP_PROMPT)
            })


        // For each result within 10 minutes from the current time:
        // - The short & long names for the route
        // - The service id for the trip
        // - Destination sign
        // - The scheduled arrival time of the vehicle
        // - The live arrival time of the vehicle
        // - The love geographic location of the vehicle

        if (isSearchAgain && isSearchAgain == 'n') {
            console.log(GOODBYE_MESSAGE)
            break;
        }

    }
}


main()
