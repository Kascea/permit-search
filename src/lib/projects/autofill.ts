import { STATE_NAMES } from "#/lib/location/states";
import { PROJECT_TEXT_FIELDS } from "#/lib/projects/types";
import type { Project, ProjectTextKey } from "#/lib/projects/types";

// Fills a PDF's empty text fields from a project, in code, by reading each
// field's name and printed label. A field that isn't a clear match is left
// for the user, and so is any match that fits more than one box, as "Phone"
// or "Height" could.

// What a project can put in a field: its text details, plus the city, state,
// cost, and "City, ST 55416" for forms that ask for them in one box. Also
// today's date, which matchesProject compares a signature date with; autofill
// doesn't fill it.
export type FillKey =
  | ProjectTextKey
  | "estimatedCost"
  | "city"
  | "state"
  | "cityStateZip"
  | "todaysDate";

const STATE_ABBREVIATIONS = new Map(
  Object.entries(STATE_NAMES).map(([abbreviation, name]) => [
    name,
    abbreviation,
  ]),
);

// What forms call each project value. A field's whole name or label has to be
// one of these. Bare "Phone" or "Email" isn't here: they could be anyone's.
const FIELD_NAMES: Partial<Record<FillKey, Array<string>>> = {
  streetAddress: [
    "Street address",
    "Address",
    "Property address",
    "Project address",
    "Site address",
    "Job site address",
    "Property street address",
  ],
  unit: ["Unit", "Unit number", "Suite", "Apartment"],
  zipCode: [
    "ZIP",
    "ZIP code",
    "Postal code",
    "Property ZIP",
    "Property ZIP code",
    "Project ZIP",
    "Project address ZIP",
  ],
  parcelNumber: [
    "Parcel",
    "Parcel number",
    "Parcel ID",
    "APN",
    "PIN",
    "PID",
    "Tax ID",
  ],
  workDescription: [
    "Description of work",
    "Work description",
    "Project description",
    "Scope of work",
  ],
  estimatedCost: [
    "Estimated cost",
    "Cost of work",
    "Project cost",
    "Contract price",
    "Valuation",
    "Job valuation",
    "Project valuation",
    "Total valuation",
    "Total job valuation",
  ],
  ownerName: ["Owner", "Owner name", "Property owner", "Property owner name"],
  ownerPhone: ["Owner phone", "Property owner phone"],
  ownerEmail: ["Owner email", "Property owner email"],
  ownerMailingAddress: [
    "Owner address",
    "Owner mailing address",
    "Property owner address",
    "Property owner mailing address",
  ],
  applicantName: ["Applicant", "Applicant name"],
  applicantPhone: ["Applicant phone"],
  applicantEmail: ["Applicant email"],
  contractorCompany: [
    "Contractor",
    "Contractor name",
    "Contractor company",
    "General contractor",
    "General contractor name",
    "Company name",
  ],
  contractorLicense: ["Contractor license", "Contractor license number"],
  contractorPhone: ["Contractor phone", "General contractor phone"],
  contractorEmail: ["Contractor email", "General contractor email"],
  city: ["City", "Property city", "Project city"],
  state: ["State", "Property state", "Project state"],
  cityStateZip: ["City state ZIP", "City state ZIP code"],
};

// Words that say nothing about what a field holds.
const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "s",
  "the",
  "to",
]);

// Short forms, so "bldg_height" and "Building height" read the same.
const SHORT_FORMS = new Map([
  ["addr", "address"],
  ["bldg", "building"],
  ["cell", "phone"],
  ["desc", "description"],
  ["ft", "feet"],
  ["lic", "license"],
  ["licence", "license"],
  ["mobile", "phone"],
  ["nbr", "number"],
  ["no", "number"],
  ["num", "number"],
  ["ph", "phone"],
  ["tel", "phone"],
  ["telephone", "phone"],
  ["zipcode", "zip"],
]);

// "OwnerPhone_1" → ["owner", "phone", "1"]; "No. of bedrooms" → ["number",
// "bedroom"].
function wordsOf(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !SMALL_WORDS.has(word))
    .map((word) => SHORT_FORMS.get(word) ?? word)
    .map((word) => (/[^s]s$/.test(word) ? word.slice(0, -1) : word));
}

function normalized(text: string) {
  return wordsOf(text).join(" ");
}

// The last part of a field's name, without its path: "contractor_phone" from
// "form.contractor_phone", and "Site_Address" from "Page1[0].Site_Address[0]".
// Empty for a numbered row such as "form.bedrooms.2".
function nameTail(name: string) {
  const tail =
    name
      .replace(/\[\d+\]/g, "")
      .split(".")
      .at(-1) ?? "";

  return /^\d+$/.test(tail) ? "" : tail;
}

const KEY_BY_NAME = new Map(
  Object.entries(FIELD_NAMES).flatMap(([key, names]) =>
    // SAFETY: FIELD_NAMES's keys are all fill keys.
    names.map((name) => [normalized(name), key as FillKey] as const),
  ),
);

// The value for each fill key, using the owner's details for the applicant
// when they're the same person.
export function fillValues(project: Project): Partial<Record<FillKey, string>> {
  const { details, city } = project;

  const values: Partial<Record<FillKey, string>> = Object.fromEntries(
    PROJECT_TEXT_FIELDS.map((field) => [field.key, details[field.key]]),
  );

  if (details.applicantIsOwner) {
    values.applicantName = details.ownerName;
    values.applicantPhone = details.ownerPhone;
    values.applicantEmail = details.ownerEmail;
  }

  // The owner's mailing address defaults to the property's.
  if (!details.ownerMailingAddress && details.streetAddress) {
    values.ownerMailingAddress = [
      details.streetAddress,
      details.unit && `Unit ${details.unit}`,
    ]
      .filter(Boolean)
      .join(", ");
  }

  values.estimatedCost =
    details.estimatedCost === null ? "" : String(details.estimatedCost);
  values.city = city?.name ?? "";
  values.state = city?.region ?? "";
  values.cityStateZip = city
    ? `${city.name}, ${STATE_ABBREVIATIONS.get(city.region) ?? city.region} ${details.zipCode}`.trim()
    : "";

  const today = new Date();

  values.todaysDate = [
    today.getMonth() + 1,
    today.getDate(),
    today.getFullYear(),
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join("/");

  return values;
}

// A box autofill can fill. label: its printed label, once the form has been
// read. width: its first box in PDF points.
interface FillField {
  id: string;
  name: string;
  label: string;
  width: number;
  isEmpty: boolean;
}

// The words a field says about itself: its name, without its row numbers, as
// "form.bedrooms.2" counts from 0 while its printed label says "Unit 3".
function fieldWords({ name, label }: FillField) {
  const nameParts = name
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter((part) => !/^\d+$/.test(part));

  return new Set(wordsOf(`${nameParts.join(" ")} ${label}`));
}

// Extra fields that fit exactly one box, by that box's ID. An extra field fits
// when its label's words are all in the box's name or printed label: "Number
// of dwellings" for "form.number_dwelling_units". Longer labels win a box.
function extraFieldsByBox(fields: Array<FillField>, project: Project) {
  const words = new Map(fields.map((field) => [field.id, fieldWords(field)]));
  const byBox = new Map<string, { value: string; labelLength: number }>();

  for (const { label, value } of project.extraFields) {
    const labelWords = wordsOf(label);

    if (!value.trim() || labelWords.length === 0) continue;

    const boxes = fields.filter((field) =>
      labelWords.every((word) => words.get(field.id)?.has(word)),
    );

    const [box] = boxes;

    if (
      boxes.length === 1 &&
      labelWords.length > (byBox.get(box.id)?.labelLength ?? 0)
    ) {
      byBox.set(box.id, { value, labelLength: labelWords.length });
    }
  }

  return byBox;
}

// Field IDs to the value each should get. Takes every text field, filled or
// not, as a value that fits more than one of them goes in none. Narrow state
// boxes get "MN" instead of "Minnesota".
export function projectFills(fields: Array<FillField>, project: Project) {
  const values = fillValues(project);
  const extras = extraFieldsByBox(fields, project);

  const keyOf = (field: FillField) =>
    KEY_BY_NAME.get(normalized(nameTail(field.name))) ??
    KEY_BY_NAME.get(normalized(field.label));

  const boxesPerKey = new Map<FillKey, number>();

  for (const field of fields) {
    const key = keyOf(field);

    if (key) boxesPerKey.set(key, (boxesPerKey.get(key) ?? 0) + 1);
  }

  const fills = new Map<string, string>();

  for (const field of fields) {
    const key = keyOf(field);

    const value = key
      ? boxesPerKey.get(key) === 1 && values[key]
      : extras.get(field.id)?.value;

    if (!value || !field.isEmpty) continue;

    fills.set(
      field.id,
      key === "state" && field.width < 60
        ? (STATE_ABBREVIATIONS.get(value) ?? value)
        : value,
    );
  }

  return fills;
}
