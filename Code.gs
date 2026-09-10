/**
 * ZPHS Jami Alumni Reunion
 * Website → Apps Script → Google Form + Google Sheet + Google Drive
 */

// ============================================================
// SETTINGS
// ============================================================

// Your Google Form ID
const FORM_ID = '1JqXNugqVdbYET3p1DRqua3td6tOdLSWFNGQ3eS6znl';

// Registration Sheet
const SHEET_NAME = 'Registrations';

// Google Drive photo folder
const DRIVE_FOLDER_NAME = 'ZPHS Jami Alumni Photos';

// Maximum photo size: 8 MB
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;


// ============================================================
// GET REQUEST
// ============================================================

function doGet() {
  return ContentService
    .createTextOutput(
      'ZPHS Jami Alumni registration service is running.'
    )
    .setMimeType(ContentService.MimeType.TEXT);
}


// ============================================================
// WEBSITE POST REQUEST
// ============================================================

function doPost(e) {

  try {

    // --------------------------------------------------------
    // CHECK DATA
    // --------------------------------------------------------

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      throw new Error(
        'No registration data received.'
      );
    }


    // --------------------------------------------------------
    // READ WEBSITE DATA
    // --------------------------------------------------------

    const data =
      JSON.parse(e.postData.contents);


    const name =
      String(data.name || '').trim();

    const village =
      String(data.village || '').trim();

    const phone =
      String(data.phone || '').trim();

    const photoName =
      String(
        data.photoName || 'photo.jpg'
      ).trim();

    const photoType =
      String(
        data.photoType || 'image/jpeg'
      ).trim();

    const photoBase64 =
      String(
        data.photoBase64 || ''
      );


    // --------------------------------------------------------
    // CHECK REQUIRED WEBSITE FIELDS
    // --------------------------------------------------------

    if (
      !name ||
      !village ||
      !phone ||
      !photoBase64
    ) {
      throw new Error(
        'Name, Village, Phone and Photo are required.'
      );
    }


    // --------------------------------------------------------
    // CHECK PHOTO SIZE
    // --------------------------------------------------------

    const estimatedBytes =
      Math.floor(
        photoBase64.length * 3 / 4
      );


    if (
      estimatedBytes >
      MAX_PHOTO_BYTES
    ) {
      throw new Error(
        'Photo is too large. Please choose a photo under 8 MB.'
      );
    }


    // --------------------------------------------------------
    // SAVE PHOTO TO GOOGLE DRIVE
    // --------------------------------------------------------

    const folder =
      getOrCreatePhotoFolder_();


    const safeName =
      makeSafeFileName_(
        name + '_' + photoName
      );


    const bytes =
      Utilities.base64Decode(
        photoBase64
      );


    const blob =
      Utilities.newBlob(
        bytes,
        photoType,
        safeName
      );


    const photoFile =
      folder.createFile(blob);


    // --------------------------------------------------------
    // SUBMIT NAME / VILLAGE / PHONE TO GOOGLE FORM
    // --------------------------------------------------------

    const formResponse =
      submitToGoogleForm_(
        name,
        village,
        phone
      );


    // --------------------------------------------------------
    // SAVE REGISTRATION TO OUR SHEET
    // --------------------------------------------------------

    const sheet =
      getOrCreateSheet_();


    sheet.appendRow([
      new Date(),
      name,
      village,
      phone,
      photoFile.getName(),
      photoFile.getUrl(),
      formResponse.getId()
    ]);


    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    return json_({
      ok: true,
      message:
        'Registration submitted successfully.',
      photoUrl:
        photoFile.getUrl(),
      formResponseId:
        formResponse.getId()
    });


  } catch (err) {

    console.error(err);

    return json_({
      ok: false,
      message:
        err &&
        err.message
          ? err.message
          : 'Registration failed.'
    });
  }
}


// ============================================================
// SUBMIT TO GOOGLE FORM
// ============================================================

function submitToGoogleForm_(
  name,
  village,
  phone
) {

  // Open the Google Form
  const form =
    FormApp.openById(
      FORM_ID
    );


  // Get all short-answer questions
  const textItems =
    form.getItems(
      FormApp.ItemType.TEXT
    );


  let nameItem = null;
  let villageItem = null;
  let phoneItem = null;


  // ----------------------------------------------------------
  // FIND QUESTIONS
  // ----------------------------------------------------------

  for (
    let i = 0;
    i < textItems.length;
    i++
  ) {

    const item =
      textItems[i].asTextItem();


    const title =
      item
        .getTitle()
        .trim()
        .toLowerCase();


    // Name
    if (
      title === 'name'
    ) {
      nameItem = item;
    }


    // Village / Area
    if (
      title === 'village/area' ||
      title === 'village' ||
      title === 'area'
    ) {
      villageItem = item;
    }


    // Phone
    if (
      title === 'phone' ||
      title === 'mobile' ||
      title === 'phone number'
    ) {
      phoneItem = item;
    }
  }


  // ----------------------------------------------------------
  // CHECK QUESTIONS EXIST
  // ----------------------------------------------------------

  if (!nameItem) {
    throw new Error(
      'Google Form question "Name" was not found.'
    );
  }


  if (!villageItem) {
    throw new Error(
      'Google Form question "Village/Area" was not found.'
    );
  }


  if (!phoneItem) {
    throw new Error(
      'Google Form question "phone" was not found.'
    );
  }


  // ----------------------------------------------------------
  // CREATE FORM RESPONSE
  // ----------------------------------------------------------

  const response =
    form.createResponse();


  // Name
  response.withItemResponse(
    nameItem.createResponse(
      name
    )
  );


  // Village
  response.withItemResponse(
    villageItem.createResponse(
      village
    )
  );


  // Phone
  response.withItemResponse(
    phoneItem.createResponse(
      phone
    )
  );


  // ----------------------------------------------------------
  // SUBMIT
  // ----------------------------------------------------------

  return response.submit();
}


// ============================================================
// GET / CREATE REGISTRATION SHEET
// ============================================================

function getOrCreateSheet_() {

  const props =
    PropertiesService
      .getScriptProperties();


  let spreadsheetId =
    props.getProperty(
      'REGISTRATION_SPREADSHEET_ID'
    );


  let ss;


  // Try existing spreadsheet
  if (spreadsheetId) {

    try {

      ss =
        SpreadsheetApp.openById(
          spreadsheetId
        );

    } catch (err) {

      ss = null;
    }
  }


  // Create spreadsheet if necessary
  if (!ss) {

    ss =
      SpreadsheetApp.create(
        'ZPHS Jami Alumni Reunion Registrations'
      );


    props.setProperty(
      'REGISTRATION_SPREADSHEET_ID',
      ss.getId()
    );
  }


  // Get registration sheet
  let sheet =
    ss.getSheetByName(
      SHEET_NAME
    );


  // Create sheet if necessary
  if (!sheet) {

    sheet =
      ss.insertSheet(
        SHEET_NAME
      );
  }


  // Add headings
  if (
    sheet.getLastRow() === 0
  ) {

    sheet.appendRow([
      'Timestamp',
      'Name',
      'Village',
      'Phone',
      'Photo File',
      'Photo URL',
      'Google Form Response ID'
    ]);


    sheet.setFrozenRows(1);
  }


  return sheet;
}


// ============================================================
// GET / CREATE PHOTO FOLDER
// ============================================================

function getOrCreatePhotoFolder_() {

  const props =
    PropertiesService
      .getScriptProperties();


  const savedId =
    props.getProperty(
      'PHOTO_FOLDER_ID'
    );


  // Try existing folder
  if (savedId) {

    try {

      return DriveApp.getFolderById(
        savedId
      );

    } catch (err) {
      // Folder no longer exists.
    }
  }


  // Create folder
  const folder =
    DriveApp.createFolder(
      DRIVE_FOLDER_NAME
    );


  props.setProperty(
    'PHOTO_FOLDER_ID',
    folder.getId()
  );


  return folder;
}


// ============================================================
// SAFE PHOTO FILE NAME
// ============================================================

function makeSafeFileName_(name) {

  return name
    .replace(
      /[\\/:*?"<>|#%{}]/g,
      '_'
    )
    .substring(
      0,
      180
    );
}


// ============================================================
// JSON RESPONSE
// ============================================================

function json_(obj) {

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


// ============================================================
// SETUP
// ============================================================

function setup() {

  const sheet =
    getOrCreateSheet_();

  const folder =
    getOrCreatePhotoFolder_();


  Logger.log(
    'Spreadsheet: ' +
    sheet.getParent().getUrl()
  );


  Logger.log(
    'Photo folder: ' +
    folder.getUrl()
  );
}


// ============================================================
// GOOGLE FORM TEST
// ============================================================

function testGoogleForm() {

  const form =
    FormApp.openById(
      FORM_ID
    );


  const textItems =
    form.getItems(
      FormApp.ItemType.TEXT
    );


  let nameItem = null;
  let villageItem = null;
  let phoneItem = null;


  for (
    let i = 0;
    i < textItems.length;
    i++
  ) {

    const item =
      textItems[i].asTextItem();


    const title =
      item
        .getTitle()
        .trim()
        .toLowerCase();


    if (
      title === 'name'
    ) {
      nameItem = item;
    }


    if (
      title === 'village/area' ||
      title === 'village' ||
      title === 'area'
    ) {
      villageItem = item;
    }


    if (
      title === 'phone' ||
      title === 'mobile' ||
      title === 'phone number'
    ) {
      phoneItem = item;
    }
  }


  if (!nameItem) {
    throw new Error(
      'Name question not found.'
    );
  }


  if (!villageItem) {
    throw new Error(
      'Village/Area question not found.'
    );
  }


  if (!phoneItem) {
    throw new Error(
      'Phone question not found.'
    );
  }


  const response =
    form.createResponse();


  response.withItemResponse(
    nameItem.createResponse(
      'TEST NAME'
    )
  );


  response.withItemResponse(
    villageItem.createResponse(
      'TEST VILLAGE'
    )
  );


  response.withItemResponse(
    phoneItem.createResponse(
      '9999999999'
    )
  );


  response.submit();


  Logger.log(
    'SUCCESS: Google Form response submitted!'
  );
}
