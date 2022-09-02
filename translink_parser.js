
import promptSync from "prompt-sync";
const prompt = promptSync({
    sigint: false
});
import fetch from "node-fetch";
import fs from 'fs';
// import { fs as fsB } from 'fs';
import { parse as csv } from "csv-parse";

import { filterTripUpdatesByStopIdAndDate, filterScheduledArrivalTime, filterServiceIdAndTripHeadsign, filterRouteNames, filterVehiclePosition, mergeAllData } from "./filterFunctions.js";


// Endpoints
const TRIP_UPDATES_URL = 'http://127.0.0.1:5343/gtfs/seq/trip_updates.json';
const VEHICLE_POSITIONS_URL = 'http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json';

// Global messages
const GREETING_MESSAGE = "Welcome to the UQ Lakes station bus tracker!";
const DATE_PROMPT = "What date will you depart UQ Lakes station by bus? ";
const TIME_PROMPT = "What time will you depart UQ Lakes station by bus? ";
const GOODBYE_MESSAGE = "Thanks for using the UQ Lakes station bus tracker!"
const QUIT_APP_PROMPT = "Would you like to search again? "
const INVALID_DATE_MESSAGE = 'Please input a valid date!'
const TRIP_NOT_FOUND = (inputDateMsg) => `Sorry, there's no trip scheduled on ${new Date(inputDateMsg * 1000).toLocaleString('en-GB', { 'timeZone': 'Australia/Queensland' })}`
const TRIP_FOUND_NUMBER = (length, inputDateMsg) => `Found ${length} trips within 10 minutes of ${new Date(inputDateMsg * 1000).toLocaleString('en-GB', { 'timeZone': 'Australia/Queensland' })}`

// Paths
const CACHE_DATA_PATH = './cached_data'
const STATIC_DATA_PATH = './static_data'
const TRIP_UPDATES_FILENAME = `${CACHE_DATA_PATH}/tripUpdates.json`
const VEHICLE_POSITIONS_FILENAME = `${CACHE_DATA_PATH}/vehiclePositions.json`
const STATIC_TRIPS_FILENAME = `${STATIC_DATA_PATH}/trips.txt`
const STATIC_ROUTES_FILENAME = `${STATIC_DATA_PATH}/routes.txt`
const STATIC_STOP_TIMES_FILENAME = `${STATIC_DATA_PATH}/stop_times.txt`

// filtered data
const FILTERED_DATA_PATH = './filtered_data';
const MERGED_DATA = `${FILTERED_DATA_PATH}/merged.json`
// const REF_ARRAY_CACHE = `${FILTERED_DATA_PATH}/refArray.json`



const CACHE_INTERVAL = 5

const STATION_STOP_ID = "1882";
let INPUT_DATE;
let DATE_INPUT;
let TIME_INPUT;

let tripUpdates;
let vehiclePositions;



async function main() {

    // Read from cache
    let tripUpdatesResponse;
    let isValidCacheTripUpdates;
    await readCache(TRIP_UPDATES_FILENAME)
        .then(res => {
            tripUpdatesResponse = JSON.parse(res)
            isValidCacheTripUpdates = validateCache(parseInt(tripUpdatesResponse.header?.timestamp) * 1000)
            // console.log("read cache", tripUpdatesResponse.header)
        })
        .catch(e => console.log("Can't read from cache", e))
    // console.log('res from cache', tripUpdatesResponse)

    let vehiclePositionsResponse;
    let isValidCacheVehiclePositions;
    await readCache(VEHICLE_POSITIONS_FILENAME)
        .then(res => {
            vehiclePositionsResponse = JSON.parse(res)
            isValidCacheVehiclePositions = validateCache(parseInt(vehiclePositionsResponse.header?.timestamp) * 1000)
            // console.log("read cache", res)
        })
        .catch(e => console.log("Can't read from cache", e))
    // console.log('res from cache', tripUpdatesResponse)


    // Get CSV Data from local
    let tripsCSV = []
    await readCSV(STATIC_TRIPS_FILENAME, tripsCSV)
    // console.log('csvtrip', tripsCSV.slice(1))
    let routesCSV = []
    await readCSV(STATIC_ROUTES_FILENAME, routesCSV)
    // console.log('csvtrip', routesCSV.slice(1))
    let stopTimesCSV = []
    await readCSV(STATIC_STOP_TIMES_FILENAME, stopTimesCSV)
    // console.log('stopTimesCSV', stopTimesCSV.slice(1))



    // Prepare data right away
    const isValidCache = isValidCacheTripUpdates && isValidCacheVehiclePositions
    // console.log('all cache validity: ', isValidCache)
    // Load from cache else fetch from API
    if (!isValidCache) {
        // Fetch all data from API
        // Fetch trip updates data
        await fetchData(TRIP_UPDATES_URL)
            .then(res => {
                tripUpdates = res.entity;
                // console.log('res trip from API', tripUpdates)
                saveCache(TRIP_UPDATES_FILENAME, res)
            })
            .catch(e => {
                console.log("Can't Fetch Trip Updates from API", e)
            })

        // Fetch vehicle positions data
        await fetchData(VEHICLE_POSITIONS_URL)
            .then(res => {
                vehiclePositions = res.entity;
                // console.log('res vehicle from API', vehiclePositions)
                saveCache(VEHICLE_POSITIONS_FILENAME, res)
            })
            .catch(e => {
                console.log("Can't Fetch Vehicle Positions from API", e)
            })
    } else {
        console.log('res trip updates from json');
        console.log('res vehicle positions from json');
    }



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
    * This function converts date & time to epoch format
    * @param {number} date - The string of date that the user inputs (YYYY-MM-DD).
    * @param {number} time - The string of time that the user inputs (HH:mm).
    * @returns {Date} The dateTime in epoch
    */
    function toEpoch(date, time) {
        // console.log('toEpochFunc', new Date(date + 'T' + time) / 1000)
        return new Date(date + 'T' + time) / 1000
    }


    /**
    * This function will validate whether the cache is expired or not
    * @param {number} dataTimestamp - The string to append to the JSON filename.
    * @returns {bool} true if not expired
    */
    function validateCache(dataTimestamp) {
        // Get current DateTime as miliseconds
        let currentDateTime = new Date()
        // console.log('current ', currentDateTime)

        // Get timestamp as miliseconds
        let cacheDateTime = new Date(dataTimestamp)
        // console.log('cache ', cacheDateTime)

        // Subtract timestamp with currentDateTime
        let cacheAge = (currentDateTime.getTime() - cacheDateTime.getTime())
        // console.log('age ', cacheAge / (1000 * 60))

        // Return true if minutes < 5
        return (cacheAge / (1000 * 60)) < CACHE_INTERVAL
    }


    /**
    * This function fetches data from a url
    * @param {string} url - The URL endpoint to fetch the data
    * @returns {Object} - return an object from the endpoint
    */
    async function fetchData(url) {
        const response = await fetch(url)
        return response.json();
    }


    /**
    * This function filters the data based on date & time from user input
    * @param {string} dateTime - The date and time from user input
    * @returns {Object} - return an array of objects containing the results
    */
    async function processData(dateTime) {
        const refArrayFromTripUpdatesAPI = filterTripUpdatesByStopIdAndDate(tripUpdatesResponse, STATION_STOP_ID, dateTime);
        // await saveCache(REF_ARRAY_CACHE, refArrayFromTripUpdatesAPI)
        console.log(TRIP_FOUND_NUMBER(refArrayFromTripUpdatesAPI.length, dateTime))
        if (refArrayFromTripUpdatesAPI.length > 0) {
            const scheduledArrivalTime = filterScheduledArrivalTime(stopTimesCSV, refArrayFromTripUpdatesAPI);
            await saveCache(`${FILTERED_DATA_PATH}/scheduled_arrival.json`, scheduledArrivalTime)
            const routeNames = filterRouteNames(routesCSV, refArrayFromTripUpdatesAPI);
            const serviceIdAndTripHeadsign = filterServiceIdAndTripHeadsign(tripsCSV, refArrayFromTripUpdatesAPI);
            const vehiclePosition = filterVehiclePosition(vehiclePositionsResponse.entity, refArrayFromTripUpdatesAPI);
            const mergedData = mergeAllData(mergeAllData(mergeAllData(scheduledArrivalTime, routeNames), serviceIdAndTripHeadsign), vehiclePosition)
            await saveCache(MERGED_DATA, mergedData)
            return mergedData;
        }
        return [];
    }


    /**
    * This function saves a data to a directory
    * @param {string} filename - The directory/filename to save the data
    * @param {Object | array | string} data - The data to save
    * @returns {Promise} - return a Promise
    */
    async function saveCache(filename, data) {
        return fs.promises.writeFile(filename, JSON.stringify(data))
    }


    /**
    * This function reads a data from a directory
    * @param {string} filename - The directory/filename to read the data from
    * @returns {Promise} - return a Promise
    */
    async function readCache(filename) {
        return fs.promises.readFile(filename, 'utf-8');
    }


    /**
    * This function reads a data (csv) from a directory
    * @param {string} filename - The directory/filename to read the data from
    * @param {array} result - The variable to store the data to
    * @returns {Promise} - return a Promise
    */
    async function readCSV(fileName, result) {
        return new Promise(function (resolve, reject) {
            fs.createReadStream(fileName)
                .pipe(csv())
                .on("data", (data) => {
                    result.push(data);
                })
                .on("end", () => {
                    resolve(result);
                })
                .on("error", reject);
        });
    }




    let isSearchAgain = null
    while (true) {
        // Show greeting
        console.log(GREETING_MESSAGE)

        // Obtain user input and validate it
        while (true) {
            // Prompt "What date will you depart UQ Lakes station by bus?"
            DATE_INPUT = prompt(DATE_PROMPT)

            // Prompt "What time will you depart UQ Lakes station by bus?"
            TIME_INPUT = prompt(TIME_PROMPT)

            // Validate user input
            const isValidInput = validateInput(DATE_INPUT, TIME_INPUT)
            if (isValidInput) {
                INPUT_DATE = toEpoch(DATE_INPUT, TIME_INPUT)
                break;
            }
            console.log(INVALID_DATE_MESSAGE)
        }


        await processData(INPUT_DATE)
            .then(res => {
                // console.log('inputEpoch', INPUT_DATE)
                if (res.length > 0) {
                    console.table(res, ['tripHeadsign', 'liveArrivalTime', 'scheduledArrivalTime', 'routeShortName', 'routeLongName', 'serviceId', 'position'])
                } else {
                    console.log(TRIP_NOT_FOUND(INPUT_DATE))
                }
                isSearchAgain = prompt(QUIT_APP_PROMPT)
            })

        if (isSearchAgain && isSearchAgain == 'n') {
            console.log(GOODBYE_MESSAGE)
            break;
        }
    }
}


main()
