let downloadLinkArray = [];
let totalFPLs = 0;

function main() {
    // read file that was submitted
    let kml = document.getElementById('formFileLg').files[0];
    let reader = new FileReader();
    reader.onload = function (e) {
        let readXML = e.target.result;
        let parser = new DOMParser();
        let kmlDoc = parser.parseFromString(readXML, "application/xml");

        // find all "Placemark" tags. This is where all of the coordinates are stored within, regardless of
        // whether it's in a document or folder, or how deeply nested it is
        let placemarks = kmlDoc.getElementsByTagName("Placemark");

        // loop through all placemarks and get their parent element
        // this will give us the actual folder/document they are a part of, so we can group the placemarks properly
        // from this point forward, i will refer to "folders" and "documents" as only "folders" 
        // because they're essentially the same damn thing
        let folders = [];

        for (let placemark in placemarks) {
            placemark = placemarks[placemark];

            // the last 3 "parent elements" are undefined, because they are not actually indexes, but some other bullshit
            // this will make sure only actual parent elements are saved
            if (placemark.parentElement) {
                folders.push(placemark.parentElement);
            }
        }

        // there will be duplicates for the folders, because there are multiple placemarks in each folder
        // this bit of code will remove any duplicates so we are left with an array with only unique folders
        let lastIndex = null;
        let currentIndex = null;
        let flights = [];

        for (let folder in folders) {
            folder = folders[folder];
            currentIndex = folders.indexOf(folder);

            if (currentIndex != lastIndex) {
                flights.push(folder);
                lastIndex = currentIndex;
            }
        }

        // initialize fplStorage dictionary
        let fplStorage = {};

        // loop through all flights, and store the name as a dict key, as well an array of coordinates as the value
        for (let flight in flights) {
            flight = flights[flight];
            let flightName = null;

            // find all elements within this flight that are called "name"
            // then find the one that has the same parent element as the flight
            // that one is the name of the flight
            // this is necessary because each placemark also has a name, and we dont want to use those names
            let names = flight.getElementsByTagName("name");
            for (let name in names) {
                name = names[name];
                if (name.parentElement == flight) {

                    // create dictionary key that is the name of the flight line
                    flightName = name.innerHTML;
                    fplStorage[flightName] = [];
                }
            }

            // create variable to store unordered coordinates
            // because unfortunately, the coords in the kml file are not in the right order for fpl
            let unorderedCoordinates = [];

            // so the fucking lines aren't placed in the right order
            // luckily it seems like the name of each placemark is in order
            // for example, for the flight "Cluster01", it has 4 placemarks
            // they are named "Cluster01_002", "Cluster01_001", "Cluster01_004", "Cluster01_003", in that order
            // this block of code will read the names, grab the last 3 digits, convert it to a number, then place them
            // in order based on those numbers.
            // as far as i can tell, those numbers are always 3 digits long, and they are always in the correct order
            for (let placemark in flight.getElementsByTagName("Placemark")) {
                placemark = flight.getElementsByTagName("Placemark")[placemark];

                // only run the code if the "placemark" is actually na object. otherwise, it is a function and we do not need it
                if (typeof placemark == 'object') {
                    let placemarkName = placemark.getElementsByTagName("name")[0].innerHTML;
                    let placemarkNumber = parseInt(placemarkName.slice(-3));
                    let coords = placemark.getElementsByTagName("coordinates")[0];

                    unorderedCoordinates[placemarkNumber - 1] = coords.innerHTML.trim();
                }
            }

            // loop through unorderedCoordinates and place them in the right order
            // basically, the lines went north to south, then north to south, then north to south, etc
            // we need them to go north to south, then south to north, then north to south, etc
            // this will flip the coordinates of every other pair so that they are in the right order
            // then it pushes them in the correct order to the fplStorage dictionary
            for (i = 0; i < unorderedCoordinates.length; i++) {
                let splitCoords = unorderedCoordinates[i].split(' ');
                if (i % 2 == 0) {
                    fplStorage[flightName].push(splitCoords[0].slice(0, -2));
                    fplStorage[flightName].push(splitCoords[1].slice(0, -2));
                } else {
                    fplStorage[flightName].push(splitCoords[1].slice(0, -2));
                    fplStorage[flightName].push(splitCoords[0].slice(0, -2));
                }
            }
        }

        console.log(fplStorage);
        totalFPLs = Object.keys(fplStorage).length;

        // now it is finally time to create an fpl file
        for (let fpl in fplStorage) {
            let name = fpl;
            fpl = fplStorage[fpl];

            let fplString = '<?xml version="1.0" encoding="utf-8"?>\n<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">'
            let currentTime = new Date();
            fplString += '\n<created>' + currentTime.getFullYear().toString() + ('0' + (currentTime.getMonth() + 1).toString()).slice(-2) + ('0' + currentTime.getDate().toString()).slice(-2);
            fplString += 'T' + ('0' + currentTime.getHours().toString()).slice(-2) + ':' + ('0' + currentTime.getMinutes().toString()).slice(-2) + ':' + ('0' + currentTime.getSeconds().toString()).slice(-2) + 'Z</created>';
            fplString += '\n<aircraft>\n\t<aircraft-tailnumber>';

            // if they didn't put in a tail number, use the placeholder
            let tailnumber = "";
            if (!document.getElementById('aircraftTailNumber').value) {
                tailnumber = 'N000AB';
            } else {
                tailnumber = document.getElementById('aircraftTailNumber').value;
            }
            fplString += tailnumber + '</aircraft-tailnumber>\n</aircraft>';

            fplString += '\n<flight-data>\n\t<etd-zulu></etd-zulu>\n\t<altitude-ft></altitude-ft>\n</flight-data>'
            fplString += '\n<waypoint-table>\n'

            // now that the setup is done, we loop through all coordinates and add them bitches in
            for (let coord in fpl) {
                coords = fpl[coord];

                let lat = coords.split(',')[1];
                let lon = coords.split(',')[0];

                fplString += '\n\t<waypoint>\n\t\t<identifier>Point' + (parseInt(coord) + 1).toString() + '</identifier>';
                fplString += '\n\t\t<type></type>';
                fplString += '\n\t\t<lat>' + lat + '</lat>';
                fplString += '\n\t\t<lon>' + lon + '</lon>';
                fplString += '\n\t\t<altitude-ft></altitude-ft>\n\t</waypoint>\n'
            }

            fplString += '\n</waypoint-table>\n<route>\n\t<route-name>' + name + '</route-name>';
            fplString += '\n\t<flight-plan-index>1</flight-plan-index>\n';

            // loop through them again for the route points.
            // this time we just need to add the point numbers
            for (let coord in fpl) {
                fplString += '\n\t<route-point>\n\t\t<waypoint-identifier>Point' + (parseInt(coord) + 1).toString() + '</waypoint-identifier>';
                fplString += '\n\t\t<waypoint-type></waypoint-type>\n\t</route-point>\n';
            }

            // finish her off
            fplString += '\n</route>\n</flight-plan>';

            // now we create all of the download links
            let filename = name + '.fpl';
            let downloadLink = document.createElement('a');
            let bb = new Blob([fplString], { type: 'text/plain' });

            downloadLink.setAttribute('href', window.URL.createObjectURL(bb));
            downloadLink.setAttribute('download', filename);
            downloadLink.setAttribute('class', 'text-light text-center justify-content-center');
            downloadLink.innerText = name + '.fpl';

            downloadLink.dataset.downloadurl = ['text/plain', downloadLink.download, downloadLink.href].join(':');
            downloadLink.draggable = true;
            downloadLink.classList.add('dragout');

            downloadLinkArray.push(downloadLink);



            let downloadDiv = document.getElementById("downloadLinks");
            downloadDiv.appendChild(downloadLink);
        }

        // create a "download all" button so you don't have to click on 400+ download links individually
        let downloadAll = document.createElement('button');
        downloadAll.setAttribute('type', 'button');
        downloadAll.setAttribute('class', 'btn btn-success btn-lg');
        downloadAll.setAttribute('onclick', 'downloadAll()');
        downloadAll.innerText = 'Download All .fpl Files (' + totalFPLs.toString() + ')';

        let downloadAllDiv = document.getElementById("downloadAll");
        downloadAllDiv.appendChild(downloadAll);
    }

    reader.readAsText(kml);
}

function downloadAll() {
    for (let link in downloadLinkArray) {
        link = downloadLinkArray[link];

        link.click();
    }
}