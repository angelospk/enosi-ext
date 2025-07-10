/**
 * Removes geospatial data from the application's JSON structure to reduce file size.
 * @param data The application data object.
 * @returns The cleaned data object without geospatial fields.
 */
export function cleanGeospatialData(data: any): any {
    if (!data) {
        return data;
    }

    // Remove top-level keys if they exist
    if ('geospatial_background' in data) {
        delete data.geospatial_background;
    }
    if ('field_neighbourhood_list' in data) {
        delete data.field_neighbourhood_list;
    }

    // Process the list of fields to remove their geospatial data
    if (data.field_list && Array.isArray(data.field_list)) {
        for (const field of data.field_list) {
            if (field && typeof field === 'object' && 'field_geospatial_data' in field) {
                delete field.field_geospatial_data;
            }
        }
    }

    return data;
}
