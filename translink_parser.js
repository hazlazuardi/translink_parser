
import promptSync from "prompt-sync";
const prompt = promptSync({
    sigint: false
});
import fetch from "node-fetch";
import fs from 'fs';
// import { fs as fsB } from 'fs';
import { parse as csv } from "csv-parse";


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
const STATIC_TRIPS_FILENAME = `${STATIC_DATA_PATH}/trips.txt`
const STATIC_ROUTES_FILENAME = `${STATIC_DATA_PATH}/routes.txt`
const STATIC_STOP_TIMES_FILENAME = `${STATIC_DATA_PATH}/stop_times.txt`

// filtered data
const FILTERED_DATA_PATH = './filtered_data';
const FILTERED_TRIP_UPDATES_API_BY_STOPID_DATE_FILENAME = `${FILTERED_DATA_PATH}/trip_updates_stopId_date_api.json`
const SCHEDULED_ARRIVAL_TIME = `${FILTERED_DATA_PATH}/scheduledArrivalTime.json`
const ROUTE_NAMES = `${FILTERED_DATA_PATH}/routeNames.json`
const SERVICE_ID_TRIP_HEADSIGN = `${FILTERED_DATA_PATH}/serviceId_tripHeadsign.json`
const VEHICLE_POSITION = `${FILTERED_DATA_PATH}/vehiclePositions_filtered.json`
const MERGED_DATA = `${FILTERED_DATA_PATH}/merged.json`



const CACHE_INTERVAL = 5

const STATION_STOP_ID = "1882";
const INPUT_DATE = 1662018000;


async function main() {

    // Read from cache
    let tripUpdatesResponse;
    await readCache(TRIP_UPDATES_FILENAME)
        .then(res => {
            tripUpdatesResponse = JSON.parse(res)
            // console.log("read cache", res)
        })
        .catch(e => console.log("Can't read from cache", e))
    // console.log('res from cache', tripUpdatesResponse)

    let vehiclePositionsResponse;
    await readCache(VEHICLE_POSITIONS_FILENAME)
        .then(res => {
            vehiclePositionsResponse = JSON.parse(res)
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


    // Part 1
    // Function to filter Trip Updates API by stopId and Date from input
    // It gets tripId, routeId, stopId => As the reference array
    function filterTripUpdatesByStopIdAndDate(resAPI, stopId, date) {
        return resAPI.entity
            // Get the stop that stops at UQ Lakes station based on stopId
            .filter(trip => trip.tripUpdate?.stopTimeUpdate?.
                some(stop => stop.stopId === stopId)
            )
            // Put it in a new key inside trip
            .map(trip => {
                return Object.assign({}, trip, {
                    'tripUpdate': {
                        ...trip.tripUpdate,
                        'stopTimeUpdate': "",
                        'stopAtUQLakesStation': trip.tripUpdate?.stopTimeUpdate?.filter(
                            stop => stop.stopId === stopId
                        )
                    }
                })
            })
            // Filter the stops by the user input date
            .filter(trip => trip.tripUpdate?.stopAtUQLakesStation?.every(stop =>
                (parseInt(stop.departure?.time) >= date) && (
                    parseInt(stop.arrival?.time) <= (date + 600)
                )
            ))
    }
    const refArrayFromTripUpdatesAPI = filterTripUpdatesByStopIdAndDate(tripUpdatesResponse, STATION_STOP_ID, INPUT_DATE)
    // console.log('raw', tripUpdatesResponse.entity.length)
    // console.log('filter', refArrayFromTripUpdatesAPI.length)
    await saveCache(FILTERED_TRIP_UPDATES_API_BY_STOPID_DATE_FILENAME, refArrayFromTripUpdatesAPI)


    // Part 2
    // Function to get scheduledArrivalTime from stop_times.txt by tripId & stopId
    function filterScheduledArrivalTime(csvArray, referenceArray) {
        return referenceArray.map(trip => {
            return Object.assign({}, {
                "tripId": trip.tripUpdate?.trip?.tripId,
                "routeId": trip.tripUpdate?.trip?.routeId,
                "liveArrivalTime": new Date(parseInt(trip.tripUpdate?.stopAtUQLakesStation[0]?.arrival?.time) * 1000).toLocaleTimeString('it-IT'),
                "scheduledArrivalTime": csvArray.filter(stop =>
                    stop[0] == trip.tripUpdate?.trip?.tripId
                    && stop[3] == 1882
                ).map(el => el[1]).toString()
            })
        })
    }
    const scheduledArrivalTime = filterScheduledArrivalTime(stopTimesCSV, refArrayFromTripUpdatesAPI);
    console.log('raw', stopTimesCSV.length)
    console.log('filter', scheduledArrivalTime.length)
    await saveCache(SCHEDULED_ARRIVAL_TIME, scheduledArrivalTime)


    // Part 3
    // Function to get routeShortName & routeLongName from routes.txt by routeId
    function filterRouteNames(csvArray, referenceArray) {
        return referenceArray.map(trip => {
            // console.log(filtered)
            return Object.assign({}, {
                "tripId": trip.tripUpdate?.trip?.tripId,
                "routeId": trip.tripUpdate?.trip?.routeId,
                "routeShortName": csvArray.filter(el => el[0] == trip.tripUpdate?.trip?.routeId).map(ele => ele[1]).toString(),
                "routeLongName": csvArray.filter(el => el[0] == trip.tripUpdate?.trip?.routeId).map(ele => ele[2]).toString(),
            })
        })
    }
    const routeNames = filterRouteNames(routesCSV, refArrayFromTripUpdatesAPI);
    console.log('raw', routesCSV.length)
    console.log('filter', routeNames.length)
    await saveCache(ROUTE_NAMES, routeNames)


    // Part 4
    // Function to get serviceId & tripHeadsign from trips.txt by routeId, tripid
    function filterServiceIdAndTripHeadsign(csvArray, referenceArray) {
        return referenceArray.map(trip => {
            return Object.assign({}, {
                "tripId": trip.tripUpdate?.trip?.tripId,
                "routeId": trip.tripUpdate?.trip?.routeId,
                "serviceId": csvArray.filter(route =>
                    route[0] == trip.tripUpdate?.trip?.routeId
                    && route[2] == trip.tripUpdate?.trip?.tripId
                ).map(ele => ele[1]).toString(),
                "tripHeadsign": csvArray.filter(route =>
                    route[0] == trip.tripUpdate?.trip?.routeId
                    && route[2] == trip.tripUpdate?.trip?.tripId
                ).map(ele => ele[3]).toString(),
            })
        })
    }
    const serviceIdAndTripHeadsign = filterServiceIdAndTripHeadsign(tripsCSV, refArrayFromTripUpdatesAPI);
    console.log('raw', tripsCSV.length)
    console.log('filter', serviceIdAndTripHeadsign.length)
    await saveCache(SERVICE_ID_TRIP_HEADSIGN, serviceIdAndTripHeadsign)


    // Part 5
    // Function to get position from Vehicle_Position_API by vehicle.id
    function filterVehiclePosition(sourceArray, referenceArray) {
        return referenceArray.map(trip => {
            return Object.assign({}, {
                "tripId": trip.tripUpdate?.trip?.tripId,
                "routeId": trip.tripUpdate?.trip?.routeId,
                "vehicleId": trip.tripUpdate?.vehicle?.id,
                "position": sourceArray.filter(vehicle =>
                    vehicle.vehicle?.vehicle?.id == trip.tripUpdate?.vehicle?.id
                    // && vehicle[2] == trip.tripUpdate?.trip?.tripId
                ).map(el => el.vehicle?.position)[0]
            })
        })
    }
    const vehiclePosition = filterVehiclePosition(vehiclePositionsResponse.entity, refArrayFromTripUpdatesAPI);
    console.log('raw', vehiclePositionsResponse.entity.length)
    console.log('filter', vehiclePosition.length)
    await saveCache(VEHICLE_POSITION, vehiclePosition)


    // Part 6
    // Function to merge all results
    function mergeAllData(targetArray, sourceArray) {

        const arr1 = targetArray

        const arr2 = sourceArray

        const arr3 = arr1.map((item, i) => Object.assign({}, item, arr2[i]));

        // console.log(arr1)
        // console.log(arr2)
        // console.log(arr3);
        return arr3;
    }
    const mergePart1And2 = mergeAllData(scheduledArrivalTime, routeNames)
    // console.log(mergePart1And2)
    const mergePart12And3 = mergeAllData(mergePart1And2, serviceIdAndTripHeadsign)
    const mergeVehiclePositions = mergeAllData(mergePart12And3, vehiclePosition)
    await saveCache(MERGED_DATA, mergeVehiclePositions)

    console.table(mergeVehiclePositions, ['tripHeadsign', 'liveArrivalTime', 'scheduledArrivalTime', 'routeShortName', 'routeLongName', 'serviceId', 'position'])







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


    function checkLessThanInterval(inputDate, dataDate, interval) {
        try {
            console.log('dataDate', dataDate)
            console.log('inputDate', inputDate)
            console.log(dataDate < inputDate + interval)
            return dataDate < inputDate + interval
        } catch (e) {
            console.log('dataDate', dataDate)
            console.log('inputDate', inputDate)
            console.log(parseInt(dataDate) < parseInt(inputDate) + parseInt(interval))
            return parseInt(dataDate) <= parseInt(inputDate) + parseInt(interval)
        }
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
        // await readCache(TRIP_UPDATES_FILENAME)
        //     .then(res => {
        //         tripUpdatesCached = res
        //         isValidCacheTripUpdates = validateCache(parseInt(res?.header?.timestamp) * 1000)
        //     })
        //     .catch(e => {
        //         console.log("Can't read trip cache", e)
        //     })
        // await readCache(VEHICLE_POSITIONS_FILENAME).then(res => {
        //     vehiclePositionsCached = res
        //     isValidCacheVehiclePositions = validateCache(parseInt(res.header.timestamp) * 1000)
        // })
        //     .catch(e => {
        //         console.log("Can't read vehicle cache")
        //     })

        // await readCache(ALERTS_FILENAME).then(res => {
        //     alertsCached = res
        //     isValidCacheAlerts = validateCache(parseInt(res.header.timestamp) * 1000)
        // })
        //     .catch(e => {
        //         console.log("Can't read alert cache")
        //     })


        // const isValidCache = isValidCacheTripUpdates && isValidCacheVehiclePositions && isValidCacheAlerts
        // console.log('all cache validity: ', isValidCache)

        // Load from cache else fetch from API
        // if (!(tripUpdatesCached && vehiclePositionsCached && alertsCached && isValidCache)) {
        if (false) {
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

            // Fetch alerts data
            await fetchData(ALERTS_URL)
                .then(res => {
                    alerts = res.entity;
                    // console.log('res alerts from API', alerts)
                    saveCache(ALERTS_FILENAME, res)
                })
                .catch(e => {
                    console.log("Can't Fetch Vehicle Positions from API", e)
                })
        } else {
            // console.log('res trip from json', tripUpdatesCached)
        }


        // TODO:
        // [ ] Merge data based on properties
        // [ ] Sort data based on departure / arrival date
        // [ ] Filter data only for 1 hour from current date

        return tripUpdatesCached;
    }

    async function saveCache(filename, data) {
        return fs.writeFileSync(filename, JSON.stringify(data))
    }

    async function readCache(filename) {
        return fs.readFileSync(filename, 'utf-8');
    }

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
                isSearchAgain = prompt(QUIT_APP_PROMPT)
            })

        if (isSearchAgain && isSearchAgain == 'n') {
            //
            break;
        }
    }
}


main()
