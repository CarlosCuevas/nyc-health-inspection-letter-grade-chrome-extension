'use strict';
/*
function schemaOrgParser() {
    const result = {};
    const element = document.querySelector('[itemscope][itemtype="http://schema.org/Restaurant"]');
    const props = element.querySelectorAll('[itemprop]');
    props.forEach(prop => {
        result[prop.getAttribute('itemprop')] = prop.content || prop.textContent || prop.src;
        if (prop.matches('[itemscope]') && prop.matches('[itemprop]')) {
            const _item = {
                'type': [prop.getAttribute('itemtype')],
                'properties': {}
            };
            prop.querySelectorAll('[itemprop]').forEach(_prop => {
                _item.properties[_prop.getAttribute('itemprop')] = _prop.content || _prop.textContent || _prop.src;
            });
            result[prop.getAttribute('itemprop')] = _item;
        }
    });
    return result;
}
*/
function determineSite() {
    const supportedSites = [
        'yelp',
        'menupages',
        'opentable',
        'grubhub'
    ];
    const url = document.URL.toLowerCase();
    let site = null;

    supportedSites.some(supportedSite => {
        if (url.indexOf(supportedSite) !== -1) {
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
            selectors.insertCardBeforeThisElement = document.querySelector('div.main-content-wrap.main-content-wrap--full').firstElementChild;
        break;
        case 'menupages':
            selectors.insertCardBeforeThisElement = document.querySelector('#cart');
        break;
        case 'opentable':
            selectors.insertCardBeforeThisElement = document.querySelector('main');
        break;
        case 'grubhub':
            selectors.insertCardBeforeThisElement = document.querySelector('#ghs-menu-page-nav');
        break;
        default:
            throw 'No selectors for ' + site;
    }

    return selectors;
};

function scrapeJsonLd() {
    let jsonldData = {};
    document.querySelectorAll('script[type="application/ld+json"]').forEach((item, index) => {
        try {
            let parsedJSON = JSON.parse(item.text)
            if (!Array.isArray(parsedJSON)) {
                parsedJSON = [parsedJSON]
            }
            parsedJSON.forEach(obj => {
                const type = obj['@type']
                jsonldData[type] = jsonldData[type] || []
                jsonldData[type].push(obj)
            });
        }
        catch (e) {
            console.error(`Error in jsonld parse - ${e}`)
        }
    });
    return jsonldData;
}

function getRestaurantInfo(selectors, site) {
    const scrapedData = scrapeJsonLd();
    const restaurantScrapedData = scrapedData.Restaurant[0];
    const restaurantInfo = {};
    const address = restaurantScrapedData.address.streetAddress;
    const firstSpace = address.indexOf(' ');
    if (firstSpace === -1) throw 'No spaces in address';

    restaurantInfo.buildingNumber = address.substr(0, firstSpace);
    restaurantInfo.street = address
    .substr(firstSpace, address.length)
    .replace(/ *\([^)]*\) */g, "")
    .trim();

    const lastSpace = restaurantInfo.street.lastIndexOf(' ');
    if (lastSpace !== -1) restaurantInfo.street = restaurantInfo.street.substring(0, lastSpace);

    /*If the street contains a digit, remove all non-digits (e.g. 3rd ave becomes 3)*/
    const containsDigit = /\d/;
    if (containsDigit.test(restaurantInfo.street)){
        restaurantInfo.street = restaurantInfo.street
        .replace(/[^0-9]/g, "")
        .trim();
    }

    restaurantInfo.name = restaurantScrapedData.name.trim()
    .toLowerCase()
        .replace(/'/g, "’")             //Replace single quotes...
        .replace(/ *\([^)]*\) */g, "")  //Replace any text within parentheses...
        .replace(/&/g, "")              //Remove ampersands
        .replace(/#/g, '');
        restaurantInfo.zipcode = restaurantScrapedData.address.postalCode.substring(0, 5);
        /*remove everything that isn't a number*/
        restaurantInfo.phone = restaurantScrapedData.telephone
        .replace(/[^0-9]/g, "")
        .trim()
    // ignore country code
    if (restaurantInfo.phone[0] === '1') restaurantInfo.phone = restaurantInfo.phone.slice(1);
    console.log(restaurantInfo);
    return restaurantInfo;

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

    return insertCardBeforeThisElement.insertBefore(inspectionCardDiv, insertCardBeforeThisElement.firstElementChild);
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
    else {
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
    while (inspectionCardDiv.hasChildNodes()) {
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

function main() {

    let site, selectors, restaurantInfo;

    try {
        site            = determineSite();
        selectors       = cacheSelectors(site);
        restaurantInfo  = getRestaurantInfo(selectors, site);
    } catch (error) {
        console.error('NYC Restaurant Health Inspection Letter Grades: ', error);
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
let previousPath = window.location.pathname.split('/');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.assert(request.action === 'url_change');
    sendResponse({message: 'ACK'});
    let currentPath = window.location.pathname.split('/');
    // grubhub
    if (currentPath[1] !== 'restaurant') return;
    if (previousPath[2] !== currentPath[2]) setTimeout(main, 5000);
});