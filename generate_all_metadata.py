#!/usr/bin/env python3


# Metadata Conversion this python files needs to be executable

import glob
import os
import pandas as pd
from pydicom import dcmread
from pydicom.tag import Tag



# Modify these Directories to your local absolute paths.

dicom_dir = "/Users/Samie/medcase/aws_s3_omn_data/neurocoils/**/*.dcm"
csv_meta_dir = "/Users/Samie/medcase/aws_s3_omn_data/metadata_csv/"




# These tags are available on the Metadata of the DICOM headers. 
# You will need to get them from the DICOM metadata viewer of the DICOM reading software.

data_to_extract = [
    ('MetaElementGroupLength', '0002,0000'),
    ('FileMetaInformationVersion', '0002,0001'),
    ('MediaStorageSOPClassUID', '0002,0002'),
    ('MediaStorageSOPInstanceUID', '0002,0003'),
    ('TransferSyntaxUID', '0002,0010'),
    ('ImplementationClassUID', '0002,0012'),
    ('ImplementationVersionName', '0002,0013'),
    ('SourceApplicationEntityTitle', '0002,0016'),
    ('ImageType', '0008,0008'),
    ('SOPClassUID', '0008,0016'),
    ('SOPInstanceUID', '0008,0018'),
    ('StudyDate', '0008,0020'),
    ('SeriesDate', '0008,0021'),
    ('AcquisitionDate', '0008,0022'),
    ('ContentDate', '0008,0023'),
    ('StudyTime', '0008,0030'),
    ('SeriesTime', '0008,0031'),
    ('AcquisitionTime', '0008,0032'),
    ('ContentTime', '0008,0033'),
    ('AccessionNumber', '0008,0050'),
    ('Modality', '0008,0060'),
    ('Manufacturer', '0008,0070'),
    ('InstitutionName', '0008,0080'),
    ('ReferringPhysiciansName', '0008,0090'),
    ('StudyDescription', '0008,1030'),
    ('SeriesDescription', '0008,103e'),
    ('AdmittingDiagnosesDescription', '0008,1080'),
    ('ManufacturersModelName', '0008,1090'),
    ('PatientsName', '0010,0010'),
    ('PatientID', '0010,0020'),
    ('PatientsBirthDate', '0010,0030'),
    ('PatientsSex', '0010,0040'),
    ('PatientsAge', '0010,1010'),
    ('EthnicGroup', '0010,2160'),
    ('SmokingStatus', '0010,21a0'),
    ('PatientIdentityRemoved', '0012,0062'),
    ('DeidentificationMethod', '0012,0063'),
    ('DeidentificationMethodCodeSequence', '0012,0064'),
    ('BodyPartExamined', '0018,0015'),
    ('SliceThickness', '0018,0050'),
    ('KVP', '0018,0060'),
    ('DataCollectionDiameter', '0018,0090'),
    ('SoftwareVersions', '0018,1020'),
    ('ProtocolName', '0018,1030'),
    ('ReconstructionDiameter', '0018,1100'),
    ('DistanceSourcetoDetector', '0018,1110'),
    ('DistanceSourcetoPatient', '0018,1111'),
    ('Gantry_DetectorTilt', '0018,1120'),
    ('TableHeight', '0018,1130'),
    ('RotationDirection', '0018,1140'),
    ('ExposureTime', '0018,1150'),
    ('X-rayTubeCurrent', '0018,1151'),
    ('Exposure', '0018,1152'),
    ('FilterType', '0018,1160'),
    ('GeneratorPower', '0018,1170'),
    ('FocalSpots', '0018,1190'),
    ('DateofLastCalibration', '0018,1200'),
    ('TimeofLastCalibration', '0018,1201'),
    ('ConvolutionKernel', '0018,1210'),
    ('PatientPosition', '0018,5100'),
    ('SingleCollimationWidth', '0018,9306'),
    ('TotalCollimationWidth', '0018,9307'),
    ('TableSpeed', '0018,9309'),
    ('ExposureModulationType', '0018,9323'),
    ('EstimatedDoseSaving', '0018,9324'),
    ('CTDIvol', '0018,9345'),
    ('StudyInstanceUID', '0020,000d'),
    ('SeriesInstanceUID', '0020,000e'),
    ('StudyID', '0020,0010'),
    ('SeriesNumber', '0020,0011'),
    ('AcquisitionNumber', '0020,0012'),
    ('InstanceNumber', '0020,0013'),
    ('ImagePositionPatient', '0020,0032'),
    ('ImageOrientationPatient', '0020,0037'),
    ('FrameofReferenceUID', '0020,0052'),
    ('PositionReferenceIndicator', '0020,1040'),
    ('SliceLocation', '0020,1041'),
    ('ImageComments', '0020,4000'),
    ('SamplesperPixel', '0028,0002'),
    ('PhotometricInterpretation', '0028,0004'),
    ('Rows', '0028,0010'),
    ('Columns', '0028,0011'),
    ('PixelSpacing', '0028,0030'),
    ('BitsAllocated', '0028,0100'),
    ('BitsStored', '0028,0101'),
    ('HighBit', '0028,0102'),
    ('PixelRepresentation', '0028,0103'),
    ('LongitudinalTemporalInformationModified', '0028,0303'),
    ('WindowCenter', '0028,1050'),
    ('WindowWidth', '0028,1051'),
    ('RescaleIntercept', '0028,1052'),
    ('RescaleSlope', '0028,1053'),
    ('WindowCenterWidthExplanation', '0028,1055'),
    ('RequestedProcedureDescription', '0032,1060'),
    ('PerformedProcedureStepStartDate', '0040,0244'),
    ('PerformedProcedureStepStartTime', '0040,0245'),
    ('PerformedProcedureStepDescription', '0040,0254'),
    ('RequestAttributesSequence', '0040,0275'),
    ('OrderEnteredBy', '0040,2008'),
    ('OrderEnterersLocation', '0040,2009'),
    ('OrderCallbackPhoneNumber', '0040,2010')
]



def folder_create_exist():
    """Checks if output directories exist."""
    os.makedirs(csv_meta_dir, mode=0o777, exist_ok=True)


def extract_file(files):
    """Read DICOM File"""
    try:
        print(f"Reading DICOM metadata from: {files}")

        with open(files, 'rb') as file:
            dicom_data = dcmread(file, stop_before_pixels=True)
            return dicom_data

    except FileNotFoundError:
        print(f"Error: File not found at {files}")
        exit()
    except Exception as e:
        print(f"An error occurred while reading the DICOM file: {e}")
        exit()


def extract_dicom_data(dicom_data, file):
    """Extract and connect Tag to Value from DICOM Datas"""
    extracted_data = {}
    for tag in data_to_extract:
        try:
            tag_number = Tag(tag[1].replace(",", ""))
        except ValueError:
            extracted_data[tag[0]] = 'INVALID TAG'
            continue
        element = dicom_data.get(tag_number, None)
        
        if element is not None:
            extracted_data[tag[0]] = str(element.value).strip()
        else:
            extracted_data[tag[0]] = 'N/A'

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


    # File name needs to be changed based on the type of data we are receiving.

    file_name = 'dicom_all_neurocoils.csv'
    csv_output_path = os.path.join(csv_meta_dir, file_name)

    df.to_csv(csv_output_path, index=False)

