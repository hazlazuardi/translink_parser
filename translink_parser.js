
import promptSync from "prompt-sync";
const prompt = promptSync({
    sigint: false
});
import fetch from "node-fetch";
import fs from 'fs';
// import { fs as fsB } from 'fs';
import { parse as csv } from "csv-parse";



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
const STATIC_TRIPS_FILENAME = `${STATIC_DATA_PATH}/trips.txt`
const STATIC_ROUTES_FILENAME = `${STATIC_DATA_PATH}/routes.txt`

const CACHE_INTERVAL = 5


async function main() {

    // let referenceArray = [];
    // let referenceArrayID = [];

    let mergedData;


    // Read from cache
    let tripUpdatesResponse;
    await readCache(TRIP_UPDATES_FILENAME)
        .then(res => {
            tripUpdatesResponse = JSON.parse(res)
            // console.log("read cache", res)
        })
        .catch(e => console.log("Can't read from cache", e))
    // console.log('res from cache', tripUpdatesResponse)

    // Get CSV Data from local
    const tripsCSV = []
    await readCSV(STATIC_TRIPS_FILENAME, tripsCSV)
    // console.log('csvtrip', tripsCSV.slice(1))
    const routesCSV = []
    await readCSV(STATIC_ROUTES_FILENAME, routesCSV)
    // console.log('csvtrip', routesCSV.slice(1))


    // route_id, service_id, trip_id
    const filteredTripsCSV = filterCSVByName("UQ Lakes station", tripsCSV, 3);
    // Function to filter csv by name
    function filterCSVByName(stationName, csvArray, stationNameIndex) {
        return csvArray.filter((ar) => ar[stationNameIndex].includes(stationName))
    }
    // console.log('filteredcsv', filteredTripsCSV)


    // Filter routes.txt by routeId to get short_name & long_name
    function filterByRouteID(csvArray, referenceArray) {
        const referenceRouteId = referenceArray.map(arr => arr[0])
        // console.log('refRoute', referenceRouteId)
        return csvArray.filter(route => {
            return referenceRouteId.includes(route[0])
        })
    }
    // route_id, route_short_name, route_long_name
    const filteredRoutesCSV = filterByRouteID(routesCSV, filteredTripsCSV);
    // console.log('filteredRoutesCSV', filteredRoutesCSV)
    const routesTxtNeeded = filteredRoutesCSV.map(route => ({
        "routeId": route[0],
        "route_short_name": route[1],
        "route_long_name": route[2]
    }))
    console.log('from routes.txt', routesTxtNeeded);


    // Filter tripUpdates by route_id from filtered trips.txt
    function filterTripUpdatesByRouteID(resAPI, referenceArray) {
        const referenceId = referenceArray.map(arr => arr[0]);
        // console.log('ref but id only', referenceId);
        // console.log('res api inside filter', resAPI.entity.map(trip => trip.tripUpdate.trip.routeId))
        // console.log('filtered by ID', resAPI?.entity?.filter(trip => {
        //     return referenceId.includes(trip.tripUpdate?.trip?.routeId)
        // }))
        return resAPI?.entity?.filter(trip => {
            return referenceId.includes(trip.tripUpdate?.trip?.routeId)
        })
    }
    // Trip Updates api filtered
    const filteredTripUpdatesAPI = filterTripUpdatesByRouteID(tripUpdatesResponse, filteredTripsCSV)
    // console.log("unfilteredTripUpdatesAPI", tripUpdatesResponse.entity.length)
    // console.log("filteredTripUpdatesAPI", filteredTripUpdatesAPI)
    await saveCache("filtered_trips_UQLakes.json", filteredTripUpdatesAPI)
        .catch(e => console.log("can't save cache filter", e))

    mergedData = filteredTripUpdatesAPI.map(trip => ({
        "tripId": trip.tripUpdate.trip.tripId,
        "routeId": trip.tripUpdate.trip.routeId,
        "vehicle": trip.tripUpdate.vehicle,
        "stopId": trip.tripUpdate.stopTimeUpdate.map(stop => stop.stopId),
        "arrival": trip.tripUpdate.stopTimeUpdate.map(stop => stop.arrival?.time),
        "departure": trip.tripUpdate.stopTimeUpdate.map(stop => stop.departure?.time),

    }))

    // console.log('merged', mergedData)



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


        // Request Trip_Upda
        // Filter Route that has UQLakes
        // uqLakesRoutes = res.map(route => route).filter(route => route.name == "UQLakes")

        // find all UQ Lakes stop_id

        return tripUpdatesCached;
    }

    async function saveCache(filename, data) {
        return fs.writeFileSync(filename, JSON.stringify(data))
    }

    async function readCache(filename) {
        // try {
        //     await fs.readFile(filename, "utf8", (err, data) => {
        //         // console.log(data)
        //         tripUpdates = data;
        //     });
        //     // console.log("Successfully read from cache", content)
        // } catch (error) {
        //     console.log("Can't read from cache (fn)", error)
        // }
        // return tripUpdates;
        // return new Promise(function (resolve, reject) {
        //     fs.createReadStream(filename)
        //         .on("data", (data) => {
        //             tmp = data
        //         })
        //         .on("end", () => {
        //             resolve(tmp);
        //         })
        //         .on("error", reject);
        // });

        return fs.readFileSync(filename, 'utf-8');
    }



    async function readCSV(fileName, array) {
        return new Promise(function (resolve, reject) {
            fs.createReadStream(fileName)
                .pipe(csv())
                .on("data", (data) => {
                    array.push(data);
                })
                .on("end", () => {
                    resolve(array);
                })
                .on("error", reject);
        });
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
                // console.log('res trip cache', tripUpdatesCached)
                // filterTripUpdatesByRouteID(res, filteredTripsCSV);

                // Read from cache
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
