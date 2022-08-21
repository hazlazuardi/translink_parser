
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
// [x] Update cache by the timestamp (every 10 minutes)
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

const CACHE_INTERVAL = 5


async function main() {


    /**
    * This function will validate whether the inputs are valid or not using Date.parse()
    * @param {number} date - The string of date that the user inputs (YYYY-MM-DD).
    * @param {number} time - The string of time that the user inputs (HH:mm).
    * @returns {bool} true if the inputs are valid
    */
    function validateInput(date, time) {
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
        // Get current DateTime as miliseconds
        let currentDateTime = new Date()
        console.log('current ', currentDateTime)

        // Get timestamp as miliseconds
        let cacheDateTime = new Date(dataTimestamp)
        console.log('cache ', cacheDateTime)

        // Subtract timestamp with currentDateTime
        let cacheAge = (currentDateTime.getTime() - cacheDateTime.getTime())
        console.log('age ', cacheAge / (1000 * 60))

        // Return true if minutes < 5
        return (cacheAge / (1000 * 60)) < CACHE_INTERVAL

    }

    async function fetchData(url) {
        const response = await fetch(url)
        return response.json();
    }

    async function processData(dateTime) {

        let tripUpdates;
        let vehiclePositions;
        let alerts;

        let mergedData = []

        let isValidCacheTripUpdates;
        let isValidCacheVehiclePositions;
        let isValidCacheAlerts;

        let tripUpdatesCached;
        let vehiclePositionsCached;
        let alertsCached;
        await readCache(TRIP_UPDATES_FILENAME).then(res => {
            tripUpdatesCached = res
            isValidCacheTripUpdates = validateCache(parseInt(res.header.timestamp) * 1000)
        })
        await readCache(VEHICLE_POSITIONS_FILENAME).then(res => {
            vehiclePositionsCached = res
            isValidCacheVehiclePositions = validateCache(parseInt(res.header.timestamp) * 1000)
        })
        await readCache(ALERTS_FILENAME).then(res => {
            alertsCached = res
            isValidCacheAlerts = validateCache(parseInt(res.header.timestamp) * 1000)
        })

        const isValidCache = isValidCacheTripUpdates && isValidCacheVehiclePositions && isValidCacheAlerts
        // console.log('all cache validity: ', isValidCache)

        // Load from cache else fetch from API
        if (!(tripUpdatesCached && vehiclePositionsCached && alertsCached && isValidCache)) {
            // Fetch all data from API
            // Fetch trip updates data
            await fetchData(TRIP_UPDATES_URL)
                .then(res => {
                    tripUpdates = res.entity;
                    console.log('res trip from API', tripUpdates)
                    saveCache(TRIP_UPDATES_FILENAME, res)
                })

            // Fetch vehicle positions data
            await fetchData(VEHICLE_POSITIONS_URL)
                .then(res => {
                    vehiclePositions = res.entity;
                    //
                    saveCache(VEHICLE_POSITIONS_FILENAME, res)
                })

            // Fetch alerts data
            await fetchData(ALERTS_URL)
                .then(res => {
                    alerts = res.entity;
                    //
                    saveCache(ALERTS_FILENAME, res)
                })
        } else {
            console.log('res trip from json', tripUpdatesCached)
        }


        // TODO:
        // [ ] Merge data based on properties
        // [ ] Sort data based on departure / arrival date
        // [ ] Filter data only for 1 hour from current date


        return mergedData;
    }

    async function saveCache(filename, data) {
        try {
            await fs.writeFile(filename, JSON.stringify(data))
            //
        } catch (error) {
            //
        }
    }

    async function readCache(filename) {
        try {
            const data = await fs.readFile(filename, "utf8");
            //
            return JSON.parse(data);
        } catch (error) {
            //
        }
    }

    let isSearchAgain = null
    while (true) {

        // Show greeting
        //

        // Obtain user input and validate it
        while (true) {
            // Prompt "What date will you depart UQ Lakes station by bus?"
            const dateInput = prompt(DATE_PROMPT)

            // Prompt "What time will you depart UQ Lakes station by bus?"
            const timeInput = prompt(TIME_PROMPT)

            const isValidInput = validateInput(dateInput, timeInput)
            if (isValidInput) {
                //
                break;
            }
            //
        }

        await processData(12)
            .then(res => {
                // //
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
            //
            break;
        }

    }
}


main()
