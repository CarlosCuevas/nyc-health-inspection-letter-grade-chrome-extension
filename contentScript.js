{
    'use strict';

    function determineSite() {
        const supportedSites = [
                'yelp',
                'menupages',
                'foursquare',
                'opentable'
            ];
        const url = document.URL.toLowerCase();
        let site = null;

        supportedSites.some(supportedSite => {
            if (url.indexOf(supportedSite) !== -1){
                site = supportedSite;
                return true;
            }
        });

        if (!site) throw 'Unsupported site';

        return site;
    };

    function cacheSelectors(site) {
        const selectors = {};

        switch(site) {
            case 'yelp':
                selectors.nameSelector                      = document.querySelector('.biz-page-title');
                selectors.addressSelector                   = document.querySelector('#wrap > div.biz-country-us > div > div.top-shelf > div > div.biz-page-subheader > div.mapbox-container > div > div.mapbox-text > ul > li.u-relative > div > strong > address');
                selectors.zipcodeSelector                   = selectors.addressSelector;
                selectors.phoneNumberSelector               = document.querySelector('.biz-phone');
                selectors.insertCardBeforeThisElement       = document.querySelector('#wrap > div.biz-country-us > div > div.top-shelf > div > div.biz-page-header.clearfix > div.biz-page-header-right');
                break;
            case 'menupages':
                selectors.nameSelector                      = document.querySelector('.header__restaurant-name');
                selectors.addressSelector                   = document.querySelector('.address-display');
                selectors.phoneNumberSelector               = document.querySelector('.restaurant-phone > a');
                selectors.insertCardBeforeThisElement       = document.querySelector('#cart');
                break;
            case 'foursquare':
                selectors.nameSelector                      = document.querySelector('h1.venueName');
                selectors.addressSelector                   = document.querySelector('#container > div.venueDetail.hasPhoto > div.contents > div.sidebar > div.sideVenueBlock > div.venueDetails > div.addressBlock.sideVenueBlockRow > div.venueRowContent > div.venueAddress > div > span:nth-child(1)');
                selectors.zipcodeSelector                   = document.querySelector('#container > div.venueDetail.hasPhoto > div.contents > div.sidebar > div.sideVenueBlock > div.venueDetails > div.addressBlock.sideVenueBlockRow > div.venueRowContent > div.venueAddress > div > span:nth-child(5)');
                selectors.phoneNumberSelector               = document.querySelector('#container > div.venueDetail.hasPhoto > div.contents > div.sidebar > div.sideVenueBlock > div.venueDetails > div:nth-child(3) > div.venueRowContent > span');
                selectors.insertCardBeforeThisElement       = document.querySelector('#container > div.venueDetail.hasPhoto > div.contents > div.sidebar > div.sideVenueBlock');
                break;
            case 'opentable':
                selectors.nameSelector                      = document.querySelector('[itemprop=name]');
                selectors.addressSelector                   = document.querySelector('[itemprop=streetAddress]');
                selectors.zipcodeSelector                   = selectors.addressSelector;
                selectors.phoneNumberSelector               = document.querySelector('#overview-section > div:nth-child(4) > div._9490eab7 > div.d62c8227 > div > div:nth-child(1) > div > div:nth-child(4) > div > div._199894c6 > div._16c8fd5e._1f1541e1');
                selectors.insertCardBeforeThisElement       = document.querySelector('main');
                break;
            default:
                throw 'No selectors for ' + site;
        }

        /*Test if all the selectors returned a DOM element*/
        for (let selector in selectors) {
            if (!selectors[selector]) throw selector + ' did not return a DOM element';
        }

        return selectors;
    };

    function getRestaurantInfo(selectors, site) {
        const restaurantInfo = {};

        /*
         Split Address Info:
         Everything before the first space is assumed to be the building number.
         Everything between the first space and the last space is assumed to be the street name.
         e.g.
         address = 111 Wycoff Ave
         building = 111
         street = wycoff
         */

        /*Opentable and Yelp has the entire address (i.e. building, street, city, state, and zip code) in one div, with a <br> between the street and city
         e.g.
         111 Wycoff Ave
         <br>
         Brooklyn, NY 11237 */
        const address = ['opentable', 'yelp'].includes(site)? selectors.addressSelector.firstChild.wholeText.trim() : selectors.addressSelector.innerText.trim();

        const firstSpace = address.indexOf(' ');
        if (firstSpace === -1) throw 'No spaces in address';

        restaurantInfo.buildingNumber = address.substr(0, firstSpace);

        restaurantInfo.street = address
            .substr(firstSpace, address.length)
            .replace(/ *\([^)]*\) */g, "")
            .trim();

        const lastSpace = restaurantInfo.street.lastIndexOf(' ');
        if (lastSpace !== -1) restaurantInfo.street = restaurantInfo.street.substring(0,lastSpace);

        /*If the street contains a digit, remove all non-digits (e.g. 3rd ave becomes 3)*/
        const containsDigit = /\d/;
        if (containsDigit.test(restaurantInfo.street)){
            restaurantInfo.street = restaurantInfo.street
                .replace(/[^0-9]/g, "")
                .trim();
        }

        /*
         Replace single quotes with right single quotes in the name (as single quotes are used to demarcate the end of the search value in the query)
         Remove any text within parentheses, as well as the parenthesis themselves (seamless)
         Remove any ampersands
         Remove any hashtags
         */
        restaurantInfo.name = selectors.nameSelector.innerText
            .trim()
            .toLowerCase()
            .replace(/'/g, "’")             //Replace single quotes...
            .replace(/ *\([^)]*\) */g, "")  //Replace any text within parentheses...
            .replace(/&/g, "")              //Remove ampersands
            .replace(/#/g, '');             //Remove hashtags

        /*Remove everything after a dash (opentable)*/
        const dash = restaurantInfo.name.indexOf('-');
        if (dash !== -1) restaurantInfo.name = restaurantInfo.name.substring(0, dash);


        /*Again, because Opentable stores the entire address in one div, separated by a <br>, another exception is needed.
         The lastChild returns string with the city, state and zip. Regex removes everything that isn't a number (yielding only the zipcode)*/
        if (selectors.zipcodeSelector) { /*Some sites don't provide a zipcode (grubhub)*/
            restaurantInfo.zipcode = ['opentable', 'yelp', 'menupages'].includes(site)? selectors.zipcodeSelector.lastChild.wholeText.replace(/[^0-9]/g, "").trim() : selectors.zipcodeSelector.innerText.trim();
        }

        /*remove everything that isn't a number*/
        restaurantInfo.phone = selectors.phoneNumberSelector.innerText
            .replace(/[^0-9]/g, "")
            .trim();

        for (let prop in restaurantInfo) {
            if (!restaurantInfo[prop]) throw 'Selector for ' + prop + ' field did not yield any value';
        }

        return restaurantInfo;
    };

    function createInspectionCardDiv(insertCardBeforeThisElement) {
        const inspectionCardDiv = document.createElement('div');

        insertCardBeforeThisElement.parentNode.insertBefore(inspectionCardDiv, insertCardBeforeThisElement);

        return inspectionCardDiv;
    };

    function displayLoadingAnimation(inspectionCardDiv, site) {

        inspectionCardDiv.setAttribute('class', 'inspectionSpinner ' + site);

        const cube1 = document.createElement('div');
        const cube2 = document.createElement('div');

        cube1.setAttribute('class', 'cube1');
        cube2.setAttribute('class', 'cube2');

        inspectionCardDiv.appendChild(cube1);
        inspectionCardDiv.appendChild(cube2);

    };

    function displayResult(mostRecentInspection, inspectionCardDiv, site) {
        /*
         Check for grade or action:
         - If grade exists, display corresponding image
         - If action exists and it indicates closure, display closed image
         */

        let gradeClassToApply = '';

        if (!mostRecentInspection) {
            gradeClassToApply = "noResultsFound";
        }
        else if (mostRecentInspection.grade) {
            switch(mostRecentInspection.grade) {
                case 'A':
                    gradeClassToApply = "gradeA";
                    break;
                case 'B':
                    gradeClassToApply = "gradeB";
                    break;
                case 'C':
                    gradeClassToApply = "gradeC";
                    break;
                case 'Z':
                    gradeClassToApply = "gradePending";
                    break;
                case 'Not Yet Graded':
                    gradeClassToApply = "notYetGraded";
                    break;
                default:
                    throw 'No Matching Grade';
            }
        }
        else{
            if (!mostRecentInspection.action) {
                gradeClassToApply = "notYetGraded";
            }
            else if (mostRecentInspection.action.substring(0,20) === 'Establishment Closed') {
                gradeClassToApply = "gradeClosed";
            }
            else {
                throw 'No Matching Action';
            }
        }

        /*remove loading animation cubes*/
        while(inspectionCardDiv.hasChildNodes()) {
            inspectionCardDiv.removeChild(inspectionCardDiv.lastChild);
        }
        /*apply id & classes*/
        inspectionCardDiv.setAttribute("id", "inspectionCard");
        inspectionCardDiv.setAttribute("class", gradeClassToApply + ' ' + site);

        /*If a grade or action exists, show inspection date*/
        if (mostRecentInspection && (mostRecentInspection.grade || mostRecentInspection.action)) {
            const inspectionDate = new Date(mostRecentInspection.inspection_date);

            const inspectionDateElement = document.createElement('span');
            inspectionDateElement.setAttribute("id", "inspectionDate");
            inspectionDateElement.setAttribute("title", "Inspection Date");

            const inspectionDateText = document.createTextNode((inspectionDate.getMonth()+1) + '/' + inspectionDate.getUTCDate() + '/' + inspectionDate.getFullYear());
            inspectionDateElement.appendChild(inspectionDateText);

            inspectionCardDiv.appendChild(inspectionDateElement);
        }

    };

    function verifyMatch(mostRecentInspection, restaurantInfo) {
        if (!mostRecentInspection) return;

        /*
         * If the phone number doesn't match, check if the building numbers match.
         * Can't do this in the query because the live data often has trailing whitespace
         */
        if (mostRecentInspection.phone.trim() !== restaurantInfo.phone) return mostRecentInspection.building.trim() === restaurantInfo.buildingNumber;

        return true;
    };

    function get(params) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.addEventListener("error", reject);
            xhr.addEventListener("load", resolve);
            xhr.open("GET", "https://data.cityofnewyork.us/resource/9w7m-hzhe.json?" + params, true);
            xhr.send(null);
        });
    };

    function convertObjectToParamString(queryParamsObj) {
        return Object.keys(queryParamsObj).map(key => {
            return key + '=' + queryParamsObj[key];
        }).join('&');
    };

    function buildWhereQuery(restaurantInfo, gradeNotNull) {
        const queryParamsObj = {};
        queryParamsObj.$where = "phone='" 	+ restaurantInfo.phone
        + "' OR ( dba='" + restaurantInfo.name
        + "' AND zipcode='" + restaurantInfo.zipcode
        + "' )";
        queryParamsObj.$order = "inspection_date DESC";
        queryParamsObj.$limit = "1";

        if (gradeNotNull) queryParamsObj.$where += ' AND grade IS NOT NULL';

        return convertObjectToParamString(queryParamsObj);
    };

    function buildFullTextQuery(restaurantInfo, gradeNotNull) {
        const queryParamsObj = {};
        queryParamsObj.$q = restaurantInfo.name + ' ' + restaurantInfo.buildingNumber + ' ' + restaurantInfo.street;
        queryParamsObj.$order = "inspection_date DESC";
        queryParamsObj.$limit = "1";

        if (gradeNotNull) queryParamsObj.$where = 'grade IS NOT NULL';

        return convertObjectToParamString(queryParamsObj);
    };

    function validateInspectionData(inspection) {
        return (inspection && ((inspection.grade) || (!inspection.action) || (inspection.action.substring(0,20) === 'Establishment Closed')));
    };

    function runSearch(params) {
        return get(params)
            .then(promise => {
                const mostRecentInspectionArray = JSON.parse(promise.target.response);
                return mostRecentInspectionArray[0];
            });
    };

    function runWhereClauseSearch(restaurantInfo, gradeNotNull) {
        if (!restaurantInfo.zipcode) {
            return new Promise(resolve => {
                resolve(null);
            });
        }

        const whereQueryParams = buildWhereQuery(restaurantInfo, gradeNotNull);

        return runSearch(whereQueryParams);
    };

    function runFullTextSearch(restaurantInfo, gradeNotNull) {
        const fullTextQueryParams = buildFullTextQuery(restaurantInfo, gradeNotNull);
        return runSearch(fullTextQueryParams);
    };

    function reportError(errorObj) {
        console.error('NYC Restaurant Health Inspection Letter Grades: ' + errorObj.message);
    };

    function main() {

        let site, selectors, restaurantInfo;

        try{
            site            = determineSite();
            selectors       = cacheSelectors(site);
            restaurantInfo  = getRestaurantInfo(selectors, site);
        }
        catch(error){
            reportError(new Error(error));
            return;
        }


        selectors.inspectionCardDiv = createInspectionCardDiv(selectors.insertCardBeforeThisElement, site);

        displayLoadingAnimation(selectors.inspectionCardDiv, site);

        /*Search for data*/
        /*Flow:
         Do a where clause search. Where clause looks for a phone match or a name and zipcode match.
         If the return value passes validation, verify the match by comparing the building number and street address.
         If the return value doesn't pass validation, it means the most recent inspection was probably an ungraded one,
         so perform another where clause search but specify that grade may not be null.
         If the return value from the search is null or the first result is valid but not a match, do a full text search.
         Full text search ($q from SODA2 API) uses name, building, and street.
         If the return value passes validation, verify the match. If it doesn't pass validation, do another full text search
         specifying that grade is not null. If the match isn't verified, return null.
         In either case, if the search returns a result that is both validated and verified, the promise chain will skip to
         displaying the grade.
         */
        runWhereClauseSearch(restaurantInfo, false)
            .then(mostRecentInspection => {
                if (!mostRecentInspection) return;

                if (!validateInspectionData(mostRecentInspection)) {
                    return runWhereClauseSearch(restaurantInfo, true)
                        .then(mostRecentInspection => (validateInspectionData(mostRecentInspection) && verifyMatch(mostRecentInspection, restaurantInfo))? mostRecentInspection : null);
                }

                return verifyMatch(mostRecentInspection, restaurantInfo)? mostRecentInspection : null;
            })
            .then(mostRecentInspection => {
                if (mostRecentInspection) return mostRecentInspection;

                return runFullTextSearch(restaurantInfo, false)
                    .then(mostRecentInspection => {
                        if (!mostRecentInspection) return;

                        if (!validateInspectionData(mostRecentInspection)) {
                            return runFullTextSearch(restaurantInfo, true)
                                .then(mostRecentInspection => (validateInspectionData(mostRecentInspection) && verifyMatch(mostRecentInspection, restaurantInfo))? mostRecentInspection : null);
                        }

                        return verifyMatch(mostRecentInspection, restaurantInfo)? mostRecentInspection : null;
                    });

            })
            .then(mostRecentInspection => {
                displayResult(mostRecentInspection, selectors.inspectionCardDiv, site);
            })
            .catch(error => {
                reportError(error);
            });

    };

    main();
}
