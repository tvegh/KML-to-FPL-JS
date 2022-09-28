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

        // get top level "Document" tag
        let mainDocument = kmlDoc.documentElement.childNodes[1];

        // in the example i was given, all of the flight lines were stored in the last tag called "Folder"
        let topLevelFolder = mainDocument.lastElementChild;

        if (!topLevelFolder) {
            window.alert("Error! It seems there is an issue with the KML file you have uploaded. Most likely, it is not encoded properly. You can fix this by opening the KML file in a text editor and removing the first and last lines.")
        }

        // sometimes the flight line is a folder and sometimes its a document.
        // they need to be handled differently, so im storing the folders and documents in different arrays        
        let flFolders = [];
        let flDocuments = [];

        for (let child in topLevelFolder.children) {
            child = topLevelFolder.children[child];

            if (child.nodeName == "Folder") {
                flFolders.push(child);
            } else if (child.nodeName == "Document") {
                flDocuments.push(child);
            }
        }

        // initialize fplStorage dictionary
        let fplStorage = {};

        // loop through all folders, and store the name as a dict key, as well an array of coordinates as the value
        for (let folder in flFolders) {
            folder = flFolders[folder];

            // create dictionary key that is the name of the flight line
            fplStorage[folder.children[0].innerHTML] = []

            // create variable to store unordered coordinates
            // because unfortunately, the coords in the kml file are not in the right order for fpl
            let unorderedCoordinates = [];

            // get all coordinates and store them into the unorderedCoorindates array
            for (let child in folder.children) {
                child = folder.children[child];

                if (child.nodeName == "Placemark") {

                    for (let node in child.children) {
                        node = child.children[node];

                        if (node.nodeName == "LineString") {
                            let coordinates = node.children[0].innerHTML.trim();
                            unorderedCoordinates.push(coordinates);
                        }
                    }
                }

                // sometimes "Placemark" tags are nested another 2 layers deep, so if we dont find a placemark tag, then we need to go deeper (inception horn)
                // so far, it seems like that will only happen when there's a document tag. and the document tag only shows up when the placemark is more layers deep
                if (child.nodeName == "Document") {
                    for (let node in child.children) {
                        node = child.children[node];

                        if (node.nodeName == "Document") {

                            for (let documentNode in node.children) {
                                documentNode = node.children[documentNode];

                                if (documentNode.nodeName == "Placemark") {

                                    // SO MANY NESTED LOOPS JESUS CHRIST
                                    for (let placemarkNode in documentNode.children) {
                                        placemarkNode = documentNode.children[placemarkNode];

                                        if (placemarkNode.nodeName == "LineString") {
                                            let coordinates = placemarkNode.children[0].innerHTML.trim();
                                            unorderedCoordinates.push(coordinates);
                                        }
                                    }
                                }
                            }
                        }
                    }

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
                    fplStorage[folder.children[0].innerHTML].push(splitCoords[0].slice(0, -2));
                    fplStorage[folder.children[0].innerHTML].push(splitCoords[1].slice(0, -2));
                } else {
                    fplStorage[folder.children[0].innerHTML].push(splitCoords[1].slice(0, -2));
                    fplStorage[folder.children[0].innerHTML].push(splitCoords[0].slice(0, -2));
                }
            }
        }

        // this does the exact same thing as the folder loop, just for the documents tags
        // the only difference is the coordinates are nested 1 fewer layers deep in document tags
        for (let document in flDocuments) {
            document = flDocuments[document];

            fplStorage[document.children[0].innerHTML] = []

            let unorderedCoordinates = [];

            for (let child in document.children) {
                child = document.children[child];

                if (child.nodeName == "Placemark") {

                    // this is the only difference from the folder loop above
                    let coordinates = child.children[3].children[0].innerHTML.trim();

                    unorderedCoordinates.push(coordinates);
                }
            }

            for (i = 0; i < unorderedCoordinates.length; i++) {
                let splitCoords = unorderedCoordinates[i].split(' ');
                if (i % 2 == 0) {
                    fplStorage[document.children[0].innerHTML].push(splitCoords[0].slice(0, -2));
                    fplStorage[document.children[0].innerHTML].push(splitCoords[1].slice(0, -2));
                } else {
                    fplStorage[document.children[0].innerHTML].push(splitCoords[1].slice(0, -2));
                    fplStorage[document.children[0].innerHTML].push(splitCoords[0].slice(0, -2));
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