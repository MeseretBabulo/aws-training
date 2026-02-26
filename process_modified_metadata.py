#!/usr/bin/env python3


# Metadata Conversion this python files needs to be executable

import glob
import os
import pandas as pd
from pydicom import dcmread
from pydicom.tag import Tag


# Modify these Directories to your local absolute paths.

dicom_dir = "/Users/Samie/medcase/aws_s3_omn_data/revised/**/*.dcm"
csv_meta_dir = "/Users/Samie/medcase/aws_s3_omn_data/metadata_csv/"


# These tags are available on the Metadata of the DICOM headers. 
# You will need to get them from the DICOM metadata viewer of the DICOM reading software.

data_to_extract = [
    'FileMetaInformationGroupLength',
    'FileMetaInformationVersion',
    'MediaStorageSOPClassUID',
    'MediaStorageSOPInstanceUID',
    'TransferSyntaxUID',
    'ImplementationClassUID',
    'ImplementationVersionName',
    'SourceApplicationEntityTitle',
    'SpecificCharacterSet',
    'ImageType',
    'SOPClassUID',
    'SOPInstanceUID',
    'StudyDate',
    'SeriesDate',
    'AcquisitionDate',
    'ContentDate',
    'AcquisitionDateTime',
    'StudyTime',
    'SeriesTime',
    'AcquisitionTime',
    'ContentTime',
    'AccessionNumber',
    'Modality',
    'Manufacturer',
    'InstitutionName',
    'ReferringPhysicianName',
    'StudyDescription',
    'ProcedureCodeSequence',
    'SeriesDescription',
    'ManufacturerModelName',
    'PatientName',
    'PatientID',
    'PatientBirthDate',
    'PatientSex',
    'PatientAge',
    'PatientSize',
    'PatientWeight',
    'EthnicGroup',
    'SmokingStatus',
    'PregnancyStatus',
    'PatientReligiousPreference',
    'PatientIdentityRemoved',
    'DeidentificationMethod',
    'DeidentificationMethodCodeSequence',
    'BodyPartExamined',
    'SliceThickness',
    'KVP',
    'DataCollectionDiameter',
    'SoftwareVersions',
    'ProtocolName',
    'ReconstructionDiameter',
    'DistanceSourcetoDetector',
    'DistanceSourcetoPatient',
    'GantryDetectorTilt',
    'TableHeight',
    'RotationDirection',
    'ExposureTime',
    'XRayTubeCurrent',
    'Exposure',
    'FilterType',
    'GeneratorPower',
    'FocalSpots',
    'DateofLastCalibration',
    'TimeofLastCalibration',
    'ConvolutionKernel',
    'PatientPosition',
    'SingleCollimationWidth',
    'TotalCollimationWidth',
    'TableSpeed',
    'TableFeedPerRotation',
    'SpiralPitchFactor',
    'DataCollectionCenterPatient',
    'ReconstructionTargetCenterPatient',
    'ExposureModulationType',
    'EstimatedDoseSaving',
    'CTDIvol',
    'CTDIPhantomTypeCodeSequence',
    'CalciumScoringMassFactorDevice',
    'StudyInstanceUID',
    'SeriesInstanceUID',
    'StudyID',
    'SeriesNumber',
    'AcquisitionNumber',
    'InstanceNumber',
    'ImagePositionPatient',
    'ImageOrientationPatient',
    'FrameofReferenceUID',
    'PositionReferenceIndicator',
    'SliceLocation',
    'ImageComments',
    'SampleperPixel',
    'PhotometricInterpretation',
    'Rows',
    'Columns',
    'PixelSpacing',
    'BitsAllocated',
    'BitsStored',
    'HighBit',
    'PixelRepresentation',
    'SmallestImagePixelValue',
    'LargestImagePixelValue',
    'LongitudinalTemporalInformationModified',
    'WindowCenter',
    'WindowWidth',
    'RescaleIntercept',
    'RescaleSlope',
    'RescaleType',
    'WindowCenterWidthExplanation',
    'StudyPriorityID'
    'ReasonforStudy',
    'RequestedProcedureDescription',
    'RequestedProcedureCodeSequence',
    'SpecialNeeds',
    'RequestAttributesSequence',
    'OrderEnteredBy',
    'OrderEntererLocation',
    'OrderCallbackPhoneNumber',
    'OrderCallbackTelecomInformation',
]


def folder_create_exist():
    """Checks if output directories exist."""
    os.makedirs(csv_meta_dir, mode=0o777, exist_ok=True)


def extract_file(files):
    """Read DICOM Files"""
    try:
        print(f"Reading DICOM metadata from: {files}")

        with open(files, 'rb') as file:
            dicom_data = dcmread(file, stop_before_pixels=True)
            print(dicom_data)
            return dicom_data

    except FileNotFoundError:
        print(f"Error: File not found at {files}")
        exit()
    except Exception as e:
        print(f"An error occurred while reading the DICOM file: {e}")
        exit()


def extract_dicom_data(dicom_data, file):
    """Extract DICOM Datas"""
    extracted_data = {}
    for tag in data_to_extract:
        try:
            tag_number = Tag(tag)
        except ValueError:
            extracted_data[tag] = 'INVALID TAG'
            continue
        element = dicom_data.get(tag_number, None)
        
        if element is not None:
            extracted_data[tag] = str(element.value).strip()
        else:
            extracted_data[tag] = 'N/A'

        extracted_data["Path"] = str(file)
    return extracted_data



if __name__ == "__main__":
    folder_create_exist()

    for_data_frame = []

    dicom_input_files = glob.glob(dicom_dir, recursive=True)
    
    for file in dicom_input_files:
        dicom_data = extract_file(file)
        dict_for_pandas = extract_dicom_data(dicom_data, file)
        if dict_for_pandas:
            for_data_frame.append(dict_for_pandas)

    df = pd.DataFrame(for_data_frame)

    # Rename this File name to the current Batch and data type
    file_name = 'dicom_all_metadata_output_17.csv'
    csv_output_path = os.path.join(csv_meta_dir, file_name)

    df.to_csv(csv_output_path, index=False)

