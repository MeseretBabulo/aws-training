#!/usr/bin/env python3


# Metadata Conversion this python files needs to be executable

import glob
import logging
import os
import shutil
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Modify these Directories to your local absolute paths.

txt_dir = "/Users/mac/medcase/aws/aws-training/txt"
json_dir = "/Users/mac/medcase/aws/aws-training/json/"


def folder_create_exist():
    """Checks if output directories exist."""
    os.makedirs(json_dir, mode=0o777, exist_ok=True)


def process_txt_file(txt, json_path):
    """Convert Txt to Json"""
    logging.info(f"Processing TXT file: {txt}")
    redbrick_items_list = []
    study_name_list = []
    study_series_data = {}
    for file_path in txt:
        with open(file_path, "r") as f:
            for line in f:
                parts = line.split('/')
                if len(parts) < 3:
                    continue # Skip paths that don't match the expected structure

                study_name = parts[-3]
                series_name = parts[-2]
                file_name = parts[-1]

                path = str(study_name + '/' + series_name + '/' + file_name)

                if study_name not in study_name_list:
                    study_name_list.append(study_name)
                if study_name not in study_series_data:
                    study_series_data[study_name] = {}
                
                if series_name not in study_series_data[study_name]:
                    study_series_data[study_name][series_name] = []
                
                study_series_data[study_name][series_name].append(path.split('\n')[0])


    for study_name in study_name_list:
        study_entry = {
            "name": study_name,
            "series": []
        }
        for study, series_data in study_series_data.items():
            if study_name == study:
                for series_name, items_list in series_data.items():

                    series_entry = {
                        "items": items_list
                    }
                    study_entry["series"].append(series_entry)
                
        redbrick_items_list.append(study_entry)


    with open(json_path, "w") as json_file:
        json.dump(redbrick_items_list, json_file, indent=2)



if __name__ == "__main__":
    folder_create_exist()

    txt_input_files = glob.glob(os.path.join(txt_dir, '*.txt'))
    if not txt_input_files:
        logging.warning(f"No TXT files found in '{txt_dir}'. Nothing to process.")


    # Rename this File name to today's date
    json_output_filename = '2026-02-26-item-list.json'
    json_output_path = os.path.join(json_dir, json_output_filename)

    process_txt_file(txt_input_files, json_output_path)