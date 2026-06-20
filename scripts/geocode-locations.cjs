const https = require("https");
const fs = require("fs");
const path = require("path");

const ADDRESS_POINTS_RESOURCE_ID = "0b3756af-9caf-4f0f-ac28-9c6617adede4";
const outputPath = path.join("public", "LocationCoordinates.json");

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = [];
            res.on("data", chunk => data.push(chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(Buffer.concat(data).toString()));
                } catch (err) {
                    reject(err);
                }
            });
        }).on("error", reject);
    });
}

const TYPE_ABBREV = {
    "avenue": "Ave", "ave": "Ave",
    "boulevard": "Blvd", "blvd": "Blvd",
    "circle": "Circ", "circ": "Circ",
    "court": "Crt", "crt": "Crt",
    "crescent": "Cres", "cres": "Cres",
    "drive": "Dr", "dr": "Dr",
    "expressway": "Expy", "expy": "Expy",
    "gate": "Gate",
    "grove": "Grve", "grve": "Grve",
    "highway": "Hwy", "hwy": "Hwy",
    "lane": "Lane",
    "mews": "Mews",
    "path": "Path",
    "place": "Pl", "pl": "Pl",
    "road": "Rd", "rd": "Rd",
    "square": "Sq", "sq": "Sq",
    "street": "St", "st": "St",
    "terrace": "Terr", "terr": "Terr",
    "trail": "Trl", "trl": "Trl",
    "way": "Way",
};

function normalize(s) {
    return s.replace(/\.+$/, "").trim();
}

function titleCase(s) {
    return normalize(s)
        .split(" ")
        .map(word =>
            word.replace(/^([A-Za-z])(.*)/, (_, first, rest) => first.toUpperCase() + rest)
                .replace(/^(Mc)([a-z])/, (_, mc, next) => mc + next.toUpperCase())
        )
        .join(" ");
}

function normalizeType(s) {
    const cleaned = normalize(s);
    return TYPE_ABBREV[cleaned.toLowerCase()] || cleaned;
}

function formatAddress(loc) {
    return [
        loc["Street No"],
        titleCase(loc["Street Name"]),
        normalizeType(loc["Street Type"]),
        loc["Street Direction"] !== "None" ? loc["Street Direction"] : null,
    ].filter(Boolean).join(" ");
}

function lookupByFields(streetNo, linearName, linearNameType, linearNameDir) {
    const filterObj = {
        LO_NUM: parseInt(streetNo, 10),
        LINEAR_NAME: linearName,
        LINEAR_NAME_TYPE: linearNameType,
    };
    if (linearNameDir) filterObj.LINEAR_NAME_DIR = linearNameDir;

    const filters = encodeURIComponent(JSON.stringify(filterObj));
    const url = `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?id=${ADDRESS_POINTS_RESOURCE_ID}&filters=${filters}&limit=1`;
    return fetchJSON(url).then(data => {
        const record = data.result?.records?.[0];
        if (!record?.geometry) return null;
        const geo = JSON.parse(record.geometry);
        return geo.coordinates; // [lng, lat]
    });
}

async function lookupCoordinates(loc) {
    const streetNo = loc["Street No"];
    const linearName = titleCase(loc["Street Name"]);
    const linearNameType = normalizeType(loc["Street Type"]);
    const dir = loc["Street Direction"] !== "None" ? normalize(loc["Street Direction"]) : null;

    const coords = await lookupByFields(streetNo, linearName, linearNameType, dir);
    if (coords) return coords;

    // Retry without direction (e.g. source data has spurious "W")
    if (dir) return lookupByFields(streetNo, linearName, linearNameType, null);
    return null;
}

async function main() {
    const locations = JSON.parse(fs.readFileSync(path.join("public", "Locations.json"), "utf8"));
    const geo = JSON.parse(fs.readFileSync(path.join("public", "Parks and Recreation Facilities - 4326.geojson"), "utf8"));

    // Load any coordinates already cached from previous builds
    const coordinates = fs.existsSync(outputPath)
        ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
        : {};

    const geoIds = new Set(geo.features.map(f => String(f.properties.LOCATIONID)));

    const missing = locations.filter(l => {
        const hasStreet = l["Street No"] && l["Street No"] !== "None";
        const inGeo = geoIds.has(String(l["Location ID"]));
        const alreadyCached = String(l["Location ID"]) in coordinates;
        return !inGeo && hasStreet && !alreadyCached;
    });

    if (missing.length === 0) {
        console.log("All locations already geocoded — nothing to do.");
        return;
    }

    console.log(`${missing.length} new locations to geocode via address points...`);

    let found = 0;
    let notFound = 0;

    for (const loc of missing) {
        try {
            const coords = await lookupCoordinates(loc);
            if (coords) {
                coordinates[loc["Location ID"]] = coords;
                found++;
                console.log(`  ✓ ${loc["Location Name"]} → [${coords}]`);
            } else {
                notFound++;
                console.log(`  ✗ ${loc["Location Name"]} (${formatAddress(loc)}) — no match`);
            }
        } catch (err) {
            notFound++;
            console.error(`  ✗ ${loc["Location Name"]} — error: ${err.message}`);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(coordinates, null, 2));
    console.log(`\nDone. ${found} geocoded, ${notFound} not found. Saved to ${outputPath}`);
}

main().catch(err => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
