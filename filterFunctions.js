import { STATION_STOP_ID } from "./translink_parser.js"

// Part 1
/**
* This function filters Trip Updates API by stopId and Date from input
* @param {array} resAPI - The array of objects from API as the reference
* @param {string} stopId - The string that is the asked station stopId
* @param {Date} date - The epoch time from user input
* @returns {array} return a copy of resApi with filtered stopTimeUpdate
*/
export function filterTripUpdatesByStopIdAndDate(resAPI, stopId, date) {
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

// Part 2
/**
* This function gets scheduledArrivalTime from stop_times.txt by tripId & stopId
* @param {array} csvArray - The 2d array read from stop_times.txt
* @param {array} referenceArray - The array of objects filtered by stopId and Date from input
* @returns {array} return an array of objects with filtered scheduledArrivalTime, liveArrivalTime, tripId, & stopId
*/
export function filterScheduledArrivalTime(csvArray, referenceArray) {
    return referenceArray.map(trip => {
        return Object.assign({}, {
            "tripId": trip.tripUpdate?.trip?.tripId,
            "routeId": trip.tripUpdate?.trip?.routeId,
            "liveArrivalTime": new Date(parseInt(trip.tripUpdate?.stopAtUQLakesStation[0]?.arrival?.time) * 1000).toLocaleTimeString('it-IT'),
            "scheduledArrivalTime": csvArray.filter(stop =>
                stop[0] == trip.tripUpdate?.trip?.tripId
                && stop[3] == STATION_STOP_ID
            ).map(el => el[1]).toString()
        })
    })
}

// Part 3
/**
* This function gets routeShortName & routeLongName from routes.txt by routeId
* @param {array} csvArray - The 2d array read from routes.txt
* @param {array} referenceArray - The array of objects filtered by stopId and Date from input
* @returns {array} return an array of objects with filtered routeShortName, routeLongName, tripId, & stopId
*/
export function filterRouteNames(csvArray, referenceArray) {
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

// Part 4
/**
* This function gets serviceId & tripHeadsign from trips.txt by routeId, tripid
* @param {array} csvArray - The 2d array read from trips.txt
* @param {array} referenceArray - The array of objects filtered by stopId and Date from input
* @returns {array} return an array of objects with filtered serviceId, tripHeadsign, tripId, & stopId
*/
export function filterServiceIdAndTripHeadsign(csvArray, referenceArray) {
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


// Part 5
/**
* This function gets position from Vehicle_Position_API by vehicle.id
* @param {array} sourceArray - The array of objects from Vehicle Position API to be a reference
* @param {array} referenceArray - The array of objects filtered by stopId and Date from input as a reference
* @returns {array} return a copy of sourceArray with filtered vehicles by vehicle.id
*/
export function filterVehiclePosition(sourceArray, referenceArray) {
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


// Part 6
// Function to merge all results
/**
* This function merges arrays of objects based on key assuming it's ordered (in this case it is)
* @param {array} targetArray - The array of objects as the target array
* @param {array} sourceArray - The array of objects as the source array
* @returns {array} return a merged array of objects
*/
export function mergeAllData(targetArray, sourceArray) {
    const arr1 = targetArray
    const arr2 = sourceArray
    return arr1.map((item, i) => Object.assign({}, item, arr2[i]));
}
