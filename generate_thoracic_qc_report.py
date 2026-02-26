#!/usr/bin/env python3


# Metadata Conversion this python files needs to be executable

import glob
import os
import pprint
import pandas as pd
from datetime import date, timedelta
from pydicom import dcmread
from pydicom.tag import Tag
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Modify these Directories to your local absolute paths.
dicom_dir = "/Users/mac/medcase/aws/aws-training/dicom/**/*.dcm"
csv_meta_dir = "/Users/mac/medcase/aws/aws-training/qc_csv/"


# Based on Siemens requirements we only need Original and Primary Image Type.
# The functions here should reflect the Criteria given by Siemens on the Google Sheet.
# It is also explained on the Google Docs

axial = ['ORIGINAL', 'PRIMARY', 'AXIAL']
scout = ['ORIGINAL', 'PRIMARY', 'LOCALIZER']


# PMs will provide what data we will need to extract

data_to_extract = [
    "PatientName",
    "ImagePositionPatient",
    'SliceThickness',
    'EthnicGroup',
    'PatientSex',
    'Manufacturer',
    'SpiralPitchFactor',
    'StudyDate',
    "SeriesDescription",
    'SeriesInstanceUID',
    'ImageOrientationPatient',
    'Rows',
    'Columns',
    'PixelSpacing',
    'ImageType',
    'ConvolutionKernel',
]


def calculate_spacing_between_slices(series_data):
    """
    Calculates SpacingBetweenSlices using ImagePositionPatient for all adjacent slices,
    and returns the maximum spacing found.
    """
    if not series_data:
        return []
    sorted_slices = sorted(series_data, key=lambda x: float(x.get('ImagePositionPatient')[2]))

    if len(sorted_slices) < 2:
        for data in sorted_slices:
            if data.get('SliceThickness') == 'None' or not data.get('SliceThickness'):
                thickness = 0.0
            else:
                thickness = float(data.get('SliceThickness'))
            data['SpacingBetweenSlices'] = f"{thickness:.4f}"
        return sorted_slices

    spacings = []
    for i in range(len(sorted_slices) - 1):
        pos_i = sorted_slices[i].get('ImagePositionPatient')
        pos_i_plus_1 = sorted_slices[i+1].get('ImagePositionPatient')
        
        spacing = abs(pos_i_plus_1[2] - pos_i[2])
        sorted_slices[i]['SpacingBetweenSlices'] = f"{spacing:.4f}"
        sorted_slices[i+1]['SpacingBetweenSlices'] = f"{spacing:.4f}"
        spacings.append(spacing)
    
    
    is_non_uniform = len(set(spacings)) > 1

    reported_spacing = max(spacings)
    
    for data in sorted_slices:
        
        if is_non_uniform:
             data["Conclusion"] += "Non-Uniform Slice Spacing,"

        if data.get("Image Type") == "Axial":
            thickness = 0.0
            if data.get('SliceThickness') == 'None' or not data.get('SliceThickness'):
                thickness = 0.0
            else:
                thickness = float(data.get('SliceThickness'))

            if thickness < reported_spacing:
                adjusted_thickness = thickness + 1.0
                if adjusted_thickness < reported_spacing:
                    total = len(spacings)
                    greater = sum(1 for number in spacings if number > adjusted_thickness)
                    if (greater/total) > 0.05:
                        data["Conclusion"] += "Large Slice Spacing,"

    return sorted_slices


def check_image_orientation(image_type, value, extracted_data):
    """Checks image orientation"""
    if image_type == "Scout":
        column = value[3:]
        row = value[:3]
        if ((abs(round(row[2], 2)) <= 0.01) and (abs(round(row[1], 1)) == 1) and (abs(round(row[2], 2)) <= 0.01)) and ((abs(round(row[2], 2)) <= 0.01), (abs(round(column[1], 2)) <= 0.01) and (abs(round(column[2], 1)) == 1)):
            return True
        elif ((abs(round(row[0], 1)) == 1) and (abs(round(row[2], 2)) <= 0.01) and (abs(round(row[2], 2)) <= 0.01)) and ((abs(round(column[0], 2)) <= 0.01) and (abs(round(row[2], 2)) <= 0.01) and (abs(round(column[2], 1)) == 1)):
            return True
        else:
            extracted_data["Conclusion"] += "Wrong Image Orientation,"
            return False

    if image_type == "Axial":
        column = value[3:]
        row = value[:3]
        if ((abs(round(row[0], 1)) == 1) and (abs(round(row[1], 2)) <= 0.01) and (abs(round(row[2], 2)) <= 0.01)) and ((abs(round(column[0], 2)) <= 0.01) and (abs(round(column[1], 1)) == 1) and (abs(round(row[2], 2)) <= 0.01)):
            return True
        else:
            extracted_data["Conclusion"] += "Wrong Image Orientation,"
            return False


def check_pixel_spacing(image_type, value, extracted_data):
    """Checks the pixel spacing"""
    if image_type == "Scout":
        if value[0] <= 4 and value[1] <= 4:
            return True
        else:
            extracted_data["Conclusion"] += "Large Pixel Spacing,"
            return False

    if image_type == "Axial":
        if value[0] <= 1 and value[1] <= 1:
            return True
        else:
            extracted_data["Conclusion"] += "Large Pixel Spacing,"
            return False

def check_size(value, extracted_data):
    """Checks the size of Image"""
    if value >= 512:
        return True
    else:
        extracted_data["Conclusion"] += "Incorrect Small Size,"
        return False


def find_digit(character):
    """Finds a Digit in a string"""
    digits = ""
    num = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    for char in character:
        if char in num:
            digits += char
    if len(digits) > 0:
        return int(digits)
    else:
        return 0


def check_convolution_kernel(image_type, value, extracted_data):
    """Checks Convolution Kernel"""
    if image_type == "Scout":
        if type(value) == str:
            if value[0] == "T":
                return True
            else:
                extracted_data["Conclusion"] += "Incorrect Convolution Kernel,"
                return False
        else:
            if value[0][0] == "T":
                return True
            else:
                extracted_data["Conclusion"] += "Incorrect Convolution Kernel,"
                return False

    if image_type == "Axial":
        if type(value) == str:
            print(value)
            digit = find_digit(value)
            if value[:2] == "BI":
                return True 
            elif (digit >= 30):
                return True
            else:
                extracted_data["Conclusion"] += "Incorrect Convolution Kernel,"
                return False
        else:
            print(value)
            digit = find_digit(value[0])
            if value[0][:2] == "BI":
                return True 
            elif (digit >= 30):
                return True
            else:
                extracted_data["Conclusion"] += "Incorrect Convolution Kernel,"
                return False


def check_pitch_factor(image_type, value, extracted_data):
    """Checks Pitch Factor"""
    if image_type == "Axial":
        if value >= 0.45:
            return True
        else:
            extracted_data["Conclusion"] += "Incorrect Spiral Pitch Factor,"
            return False


def check_image_type(scout_set, axial_set, value_set):
    """Checks the image type"""
    if scout_set.issubset(value_set):
        return "Scout"
    if axial_set.issubset(value_set):
        return "Axial"


def check_date(value, extracted_data):
    """Checks the Study Date"""
    date = value[:4]
    if int(date) < 2018:
        extracted_data["Conclusion"] += "Older Study Date,"
        return False
    else:
        return True



def check_manufaturer(value, extracted_data):
    """Checks the Manufaturer data"""
    if value in ['SIEMENS', 'Siemens Healthineers']:
        return True
    else:
        extracted_data["Conclusion"] += "Wrong Manufacturer,"
        return False


def folder_create_exist():
    """Checks if HTML and PDF output directories exist."""
    os.makedirs(csv_meta_dir, mode=0o777, exist_ok=True)


def extract_file(files):
    """Extract File"""
    logger.info(f"Reading DICOM metadata from: {files}")
    try:
        print(f"Reading DICOM metadata from: {files}")

        with open(files, 'rb') as file:
            dicom_data = dcmread(file, stop_before_pixels=True)
            logger.info(f"DICOM metadata read successfully")
            return dicom_data

    except FileNotFoundError:
        print(f"Error: File not found at {files}")
        exit()
    except Exception as e:
        print(f"An error occurred while reading the DICOM file: {e}")
        exit()


def extract_dicom_data(dicom_data, file):
    """Extract DICOM Dataas"""
    logger.info(f"*****-----Extracting DICOM data from: {pprint.pformat(file)}")
    logger.info(f"*****-----Extracting DICOM data from: {pprint.pformat(dicom_data)}")
    tag_number = Tag('ImageType')
    element = dicom_data.get(tag_number, None)
    logger.info(f"*****-----element: {pprint.pformat(element)}")
    if element is not None:
        scout_set = set(scout)
        axial_set = set(axial)
        value_set = set(element.value)
        image_type = check_image_type(scout_set, axial_set, value_set)
        if image_type == "Scout" or image_type == "Axial":
            extracted_data = {}
            extracted_data["Conclusion"] = ""
            extracted_data['SpacingBetweenSlices'] = 'N/A' 
            extracted_data["Image Type"] = image_type

            logger.info(f"*****-----Data to extract: {pprint.pformat(data_to_extract)}")
            for tag in data_to_extract:
                try:
                    tag_number = Tag(tag)
                except ValueError:
                    if tag != "Conclusion":
                        extracted_data[tag] = 'INVALID TAG'
                        continue
                element = dicom_data.get(tag_number, None)
                
                if element is not None:
                    value_to_store = element.value
                    # logger.info(f"*****-----tag_number: {pprint.pformat(tag_number)}")
                    # logger.info(f"*****-----element: {pprint.pformat(element)}")
                    logger.info(f"*****-----value_to_store: {pprint.pformat(value_to_store)}")

                    if tag == 'Manufacturer':
                        check_manufaturer(value_to_store, extracted_data)
                    if tag == 'StudyDate':
                        check_date(value_to_store, extracted_data)
                    if tag == 'ConvolutionKernel':
                        check_convolution_kernel(image_type, value_to_store, extracted_data)
                    if tag == 'ImageOrientationPatient':
                        check_image_orientation(image_type, value_to_store, extracted_data)
                    if tag == "SpiralPitchFactor":
                        check_pitch_factor(image_type, value_to_store, extracted_data)
                    if tag == 'Rows' or tag == 'Columns':
                        check_size(value_to_store, extracted_data)
                    if tag == 'PixelSpacing':
                        check_pixel_spacing(image_type, value_to_store, extracted_data)
                    if tag == 'ImagePositionPatient':
                        value_to_store = [float(x) for x in value_to_store]

                    extracted_data[tag] = str(value_to_store).strip() if not isinstance(value_to_store, list) else value_to_store
                else:
                    extracted_data[tag] = 'N/A'

                extracted_data["Path"] = str(file)
            logger.info(f"*****-----Extracted data: {pprint.pformat(extracted_data)}")
            return extracted_data



if __name__ == "__main__":
    logger.info("Starting Thoracic QC Report")
    folder_create_exist()

    for_data_frame = []
    all_series_data = {}

    dicom_input_files = glob.glob(dicom_dir, recursive=True)
    logger.info(f"Found {len(dicom_input_files)} DICOM files")
    for file in dicom_input_files:
        logger.info(f"Processing file: {file}")
        dicom_data = extract_file(file)
        dict_for_pandas = extract_dicom_data(dicom_data, file)
        if dict_for_pandas:
            series_uid = dict_for_pandas.get('SeriesInstanceUID')
            if series_uid:
                if series_uid not in all_series_data:
                    all_series_data[series_uid] = []
                all_series_data[series_uid].append(dict_for_pandas)

    # logger.info(f"Found {len(all_series_data)} series")
    for series_uid, series_slices in all_series_data.items():
        processed_slices = calculate_spacing_between_slices(series_slices)
        for_data_frame.extend(processed_slices)

    # logger.info(f"Found {len(for_data_frame)} slices")
    df = pd.DataFrame(for_data_frame)
    logger.info(f"Creating DataFrame with {len(df)} rows")  
    # Rename this File name to the current Batch and data type
    file_name = 'dicom_thoracic_qc_batch_1.csv'
    csv_output_path = os.path.join(csv_meta_dir, file_name)

    df.to_csv(csv_output_path, index=False)

    logger.info(f"Thoracic QC Report completed successfully")