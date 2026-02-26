#!/usr/bin/env python3


# Metadata Conversion this python files needs to be executable

import glob
import os
import pandas as pd
from pydicom import dcmread
from pydicom.tag import Tag



# Modify these Directories to your local absolute paths.

dicom_dir = "/Users/Samie/medcase/aws_s3_omn_data/dicom/**/*.dcm"
revised_dir = "/Users/Samie/medcase/aws_s3_omn_data/revised_2"
base_dir = "/Users/Samie/medcase/aws_s3_omn_data/dicom"


def folder_create_exist():
    """Checks if output directories exist."""
    os.makedirs(revised_dir, mode=0o777, exist_ok=True)


def extract_file(files):
    """Read DICOM File"""
    try:
        print(f"Reading DICOM metadata from: {files}")

        with open(files, 'rb') as file:
            dicom_data = dcmread(file)
            
            # The following 5 lines need to be changed if we are using a new Vendor.
            # Instructions in the Docs will provide more information about the Vendors

            dicom_data.OrderEnteredBy = 'MC-00001'
            dicom_data.OrderEntererLocation = 'MC-00001'
            dicom_data.OrderCallbackPhoneNumber = 'MC-00001'
            dicom_data.OrderCallbackTelecomInformation = 'MC-00001'
            dicom_data.DeidentificationMethod = 'MC-00001'
            file_dicom = os.path.relpath(files, base_dir) 
            new_filepath = os.path.join(revised_dir, file_dicom)

            os.makedirs(os.path.dirname(new_filepath), exist_ok=True)
            dicom_data.save_as(new_filepath)
            return dicom_data

    except FileNotFoundError:
        print(f"Error: File not found at {files}")
        exit()
    except Exception as e:
        print(f"An error occurred while reading the DICOM file: {e}")
        exit()


if __name__ == "__main__":
    folder_create_exist()

    for_data_frame = []

    dicom_input_files = glob.glob(dicom_dir, recursive=True)
    
    for file in dicom_input_files:
        dicom_data = extract_file(file)
