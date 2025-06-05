class OpekepeAgroHelper {
    constructor(mainApplicationId, eaeYear, { verbose = false } = {}) { // Προσθήκη επιλογής verbose
        if (!mainApplicationId || !eaeYear) {
            throw new Error("Main Application ID and EAE Year are required for OpekepeAgroHelper.");
        }
        this.MAIN_APPLICATION_ID = mainApplicationId;
        this.EAE_YEAR = parseInt(eaeYear, 10);
        this.BASE_URL = "https://eae2024.opekepe.gov.gr/eae2024/rest";
        this.VERBOSE = verbose;

        this.COMMON_HEADERS = {
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json",
            "cache-control": "no-cache",
            "pragma": "no-cache"
        };
    }

    _log(message, ...args) {
        if (this.VERBOSE) {
            console.log(`[OPEKEPE Helper] ${message}`, ...args);
        }
    }

    _error(message, ...args) {
        console.error(`[OPEKEPE Helper ERROR] ${message}`, ...args);
    }


    async _fetchApi(endpoint, method = 'POST', body = null, isCatalog = false) {
        const url = `${this.BASE_URL}/${endpoint}`;
        this._log(`Fetching API: ${method} ${url}`, body || '');
        const options = {
            method: method,
            headers: { ...this.COMMON_HEADERS },
            credentials: "include"
        };
        // ... (υπόλοιπος κώδικας _fetchApi με _log και _error)
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: response.statusText, status: response.status };
                }
                this._error(`API Error (${response.status}) for ${method} ${url}:`, errorData);
                const err = new Error(errorData.message || `API request failed with status ${response.status}`);
                err.data = errorData;
                err.status = response.status;
                throw err;
            }
            const responseData = await response.json();
            this._log(`API Success: ${method} ${url}`, responseData);
            return isCatalog ? (responseData.data || responseData) : responseData;
        } catch (error) {
            // Το _error καλείται ήδη από τον αρχικό thrower αν είναι API error.
            // Αυτό πιάνει network errors ή JS errors στην επεξεργασία.
            if (!error.data) { // Αν δεν είναι ήδη επεξεργασμένο API error
                 this._error(`Network/JS Error for ${method} ${url}:`, error);
            }
            throw error;
        }
    }

    _prepareEntityForRequest(entity, dateFieldsToConvert = [], idFieldsToSimplify = []) {
        // ... (ίδιο με πριν, με πιθανές μικροβελτιώσεις στην ανάλυση ημερομηνιών αν χρειαστεί) ...
        if (!entity) return null;
        const GREEK_MONTHS = ["ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΙ", "ΙΟΥΝ", "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ"];

        const preparedEntity = { ...entity };
        delete preparedEntity.$entityName;
        delete preparedEntity.$refId;

        dateFieldsToConvert.forEach(field => {
            if (preparedEntity[field] !== null && preparedEntity[field] !== undefined) {
                if (typeof preparedEntity[field] === 'number') {
                    preparedEntity[field] = new Date(preparedEntity[field]).toISOString();
                } else if (typeof preparedEntity[field] === 'string') {
                    let d = new Date(preparedEntity[field]);
                    if (isNaN(d.getTime())) { // Try to parse DD/MM/YYYY or DD-MM-YYYY
                        const parts = preparedEntity[field].replace(/[.\/]/g, '-').split('-');
                        if (parts.length === 3) {
                            const day = parseInt(parts[0], 10);
                            const monthStr = parts[1].toUpperCase();
                            let month = parseInt(parts[1],10) -1; // Default to numeric month
                            const greekMonthIndex = GREEK_MONTHS.indexOf(monthStr);
                            if(greekMonthIndex !== -1) month = greekMonthIndex;

                            const year = parseInt(parts[2], 10);
                            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                                // Ensure year is 4 digits if it's like '25'
                                const fullYear = year < 100 ? (year > 50 ? 1900+year : 2000+year) : year;
                                d = new Date(Date.UTC(fullYear, month, day));
                            }
                        }
                    }
                    if (!isNaN(d.getTime())) {
                        preparedEntity[field] = d.toISOString();
                    } else {
                        console.warn(`Could not parse date string for field ${field}: ${preparedEntity[field]}. Leaving as is or nulling.`);
                        // Decide: leave as is, or set to null if invalid and server expects null
                        // preparedEntity[field] = null;
                    }
                }
            } else if (preparedEntity[field] === undefined) {
                preparedEntity[field] = null;
            }
        });

        idFieldsToSimplify.forEach(key => {
            const idField = key.field;
            const idKey = key.idKey || 'id'; // 'id' or 'kodikos'
            const fieldValue = preparedEntity[idField];

            if (fieldValue && typeof fieldValue === 'object') {
                if (fieldValue[idKey] !== undefined && fieldValue[idKey] !== null) {
                    // Αν είναι αντικείμενο και έχει το σωστό κλειδί (id ή kodikos)
                    preparedEntity[idField] = { [idKey]: fieldValue[idKey] };
                } else if (fieldValue["$refId"] !== undefined && fieldValue["$refId"] !== null) {
                    // Αν είναι αντικείμενο με $refId (όπως το lkpenIdA από το findById)
                    preparedEntity[idField] = { [idKey]: fieldValue["$refId"] }; // Χρησιμοποίησε το $refId ως το id
                } else {
                    // Είναι αντικείμενο αλλά δεν έχει το αναμενόμενο κλειδί ή $refId
                    this._warn(`Object for ID field ${idField} does not have '${idKey}' or '$refId'. Setting to null. Object was:`, fieldValue);
                    preparedEntity[idField] = null;
                }
            } else if (fieldValue !== null && fieldValue !== undefined) {
                // Αν είναι απλή τιμή (string/number), τη μετατρέπουμε σε αντικείμενο ID
                preparedEntity[idField] = { [idKey]: fieldValue };
            } else {
                // Αν είναι null ή undefined
                preparedEntity[idField] = null;
            }
        });
        return preparedEntity;
    }


    _prepareEdehdEntityForRequest(serverEdehdEntity) {
        // ... (ίδιο με πριν) ...
        const dateFields = ['dteinsert', 'dteupdate', 'dtebirth', 'dteprotocol', 'dtestartekm', 'dteasfalish', 'dtedraststart', 'dteonlineproseas', 'dteOris'];
        const idFields = [
            { field: 'lkkoiIdB1', idKey: 'id'}, { field: 'doyId', idKey: 'id' }, { field: 'efoId', idKey: 'id' },
            { field: 'lkpenIdA', idKey: 'id' }, { field: 'lkpenIdB1', idKey: 'id' }, { field: 'lkpenIdB2', idKey: 'id' },
            { field: 'lkkoiIdB2', idKey: 'id' }, { field: 'daokKodikos', idKey: 'kodikos' }, { field: 'opdId', idKey: 'id' },
            { field: 'ddsId', idKey: 'id' }, { field: 'ddrId', idKey: 'id' }, { field: 'lkprfId', idKey: 'id' },
            { field: 'lkprfIdB2', idKey: 'id' }, { field: 'ownerSexId', idKey: 'id' }, { field: 'sexId', idKey: 'id' }
            // Προσθήκη άλλων nested ID πεδίων αν υπάρχουν στο Edetedeaeehd
        ];
        return this._prepareEntityForRequest(serverEdehdEntity, dateFields, idFields);
    }


    _prepareAgrotemaxioEntityForRequest(serverEntity) {
        // ... (ίδιο με πριν) ...
        const prepared = this._prepareEntityForRequest(serverEntity,
                                                       ['dteinsert', 'dteupdate', 'dteensEpil', 'dteEnsPe', 'dteprotocolEda'],
                                                       [{field: 'lkkoiId', idKey: 'id', wrapSimpleId: true}, {field: 'sexIdOther', idKey: 'id', wrapSimpleId: true}, {field: 'edelId', idKey: 'id', wrapSimpleId: true}]
        );
        if (prepared) {
            if (!prepared.edeId || (typeof prepared.edeId === 'object' && !prepared.edeId.id)) {
                prepared.edeId = { id: this.MAIN_APPLICATION_ID };
            }
            // Το sexId στο αγροτεμάχιο φαίνεται να είναι απλό ID, όχι αντικείμενο στο payload
            if (typeof prepared.sexId === 'object' && prepared.sexId.id) {
                prepared.sexId = prepared.sexId.id;
            } else if (prepared.sexId === null || prepared.sexId === undefined){
                // Αν λείπει, ίσως θέλει ένα default, π.χ. 40005 που είδαμε
                // prepared.sexId = 40005;
            }
        }
        return prepared;
    }

    _prepareFytikoEntityForRequest(serverEntity) {
        const prepared = this._prepareEntityForRequest(serverEntity,
                                                       ['dteinsert', 'dteupdate', 'dteepisporhapo', 'dteepisporheos', 'dtedke'],
                                                       [
                                                           {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
                                                       {field: 'efyId', idKey: 'id', required: true}, {field: 'poiId', idKey: 'id', required: true},
                                                       {field: 'emccId', idKey: 'id'}, {field: 'elmId', idKey: 'id'},
                                                       {field: 'efecId', idKey: 'id'}, {field: 'emxpId', idKey: 'id'}
                                                       ]
        );
        if (prepared) {
            // Το sexId στο fytiko φαίνεται να είναι απλό ID, όχι αντικείμενο στο payload
            if (typeof prepared.sexId === 'object' && prepared.sexId.id) {
                prepared.sexId = prepared.sexId.id;
            } else if (prepared.sexId === null || prepared.sexId === undefined){
                // prepared.sexId = 40005; // default?
            }
            if (prepared.lkkoiId && typeof prepared.lkkoiId === 'object' && prepared.lkkoiId.id) { // Αν υπάρχει lkkoiId και είναι αντικείμενο
                prepared.lkkoiId = prepared.lkkoiId.id; // Κράτα μόνο το id value
            }
        }
        return prepared;
    }

    _prepareRequestFytikoEntityForRequest(serverEntity) {
        return this._prepareEntityForRequest(serverEntity,
                                             ['dteinsert', 'dteupdate'],
                                             [
                                                 {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
                                             {field: 'edfId', idKey: 'id', required: true}, {field: 'efyId', idKey: 'id', required: true},
                                             {field: 'poiId', idKey: 'id', required: true}, {field: 'eschId', idKey: 'id', required: true},
                                             {field: 'sexId', idKey: 'id', required: true}, {field: 'edrqcId', idKey: 'id'}, {field: 'edrqeId', idKey: 'id'}
                                             ]
        );
    }

    _prepareAgroPaaEntityForRequest(serverEntity) {
        return this._prepareEntityForRequest(serverEntity,
                                             ['dteinsert', 'dteupdate'],
                                             [
                                                 {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
                                             {field: 'eaaId', idKey: 'id', required: true}, {field: 'sexId', idKey: 'id'}
                                             ]
        );
    }

    _prepareAgroEcoEntityForRequest(serverEntity) {
        return this._prepareEntityForRequest(serverEntity,
                                             ['dteinsert', 'dteupdate'],
                                             [
                                                 {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
                                             {field: 'essuId', idKey: 'id', required: true}, {field: 'sexId', idKey: 'id'}, {field: 'esruId', idKey: 'id'}
                                             ]
        );
    }

    async fetchMainApplicationData() {
        this._log(`Fetching main application data for ID: ${this.MAIN_APPLICATION_ID}`);
        try {
            const response = await this._fetchApi('Edetedeaeehd/findById', 'POST', { id: this.MAIN_APPLICATION_ID });
            if (response && response.data && response.data.length > 0) {
                const preparedData = this._prepareEdehdEntityForRequest(response.data[0]);
                this._log("Main application data fetched and prepared successfully, rowVersion:", preparedData.rowVersion);
                return preparedData;
            }
            this._warn("No data found for main application ID:", this.MAIN_APPLICATION_ID); // Προσθήκη _warn
            return null;
        } catch (error) {
            this._error("Failed to fetch main application data:", error);
            return null;
        }
    }
    _warn(message, ...args) {
        if (this.VERBOSE) {
            console.warn(`[OPEKEPE Helper WARN] ${message}`, ...args);
        }
    }


    async fetchAllAgrotemaxia(toRow = 1000) {
        // ... (ίδιο με πριν) ...
        console.log(`Fetching all agrotemaxia for EDE ID: ${this.MAIN_APPLICATION_ID}, Year: ${this.EAE_YEAR}`);
        const payload = {
            g_Ede_id: this.MAIN_APPLICATION_ID,
            gParams_yearEae: this.EAE_YEAR,
            fromRowIndex: 0,
            toRowIndex: toRow
        };
        try {
            const response = await this._fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', 'POST', payload);
            console.log(`${response.data ? response.data.length : 0} agrotemaxia fetched.`);
            return response.data || [];
        } catch (error) {
            console.error("Failed to fetch agrotemaxia:", error);
            return [];
        }
    }

    async findAgrotemaxioById(agrotemaxioId) {
        // ... (ίδιο με πριν, αλλά χρησιμοποιεί το _prepareAgrotemaxioEntityForRequest) ...
        console.log(`Searching for agrotemaxio with ID: ${agrotemaxioId}`);
        const allAgrotemaxia = await this.fetchAllAgrotemaxia(); // Might be inefficient if list is huge
        // Consider a direct findById endpoint if available for Edetedeaeeagroi
        const foundRaw = allAgrotemaxia.find(agro => agro.id === agrotemaxioId);
        if (foundRaw) {
            const preparedData = this._prepareAgrotemaxioEntityForRequest(foundRaw);
            console.log("Agrotemaxio found and prepared:", preparedData);
            return preparedData;
        }
        console.warn("Agrotemaxio not found with ID:", agrotemaxioId);
        return null;
    }

    async getMaxAgrotemaxioKodikos() {
        // ... (ίδιο με πριν) ...
        const allAgrotemaxia = await this.fetchAllAgrotemaxia();
        if (!allAgrotemaxia || allAgrotemaxia.length === 0) {
            return 0;
        }
        return Math.max(0, ...allAgrotemaxia.map(agro => parseInt(agro.kodikos, 10) || 0));
    }

    async _synchronizeChanges(dataPayloadArray) {
        const payload = { params: { data: dataPayloadArray } };
        this._log("Synchronizing changes with payload items:", dataPayloadArray.map(d => ({name: d.entityName, status: d.status, id: d.entity.id }) ));
        // Για λόγους ασφαλείας, μπορεί να μην θέλεις να κάνεις log ολόκληρο το payload αν περιέχει ευαίσθητα δεδομένα.
        // console.log("Full sync payload (for debugging, can be large):", JSON.stringify(payload));
        return this._fetchApi('MainService/synchronizeChangesWithDb_Edetedeaeeagroi', 'POST', payload);
    }

    async createAgrotemaxio(newAgrotemaxioPartialData) {
        // ... (ίδιο με πριν, αλλά χρησιμοποιεί το getMaxAgrotemaxioKodikos) ...
        console.log("Attempting to create new agrotemaxio with data:", newAgrotemaxioPartialData);
        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) {
            console.error("Cannot create agrotemaxio: Failed to fetch main application data.");
            alert("Αποτυχία λήψης δεδομένων κύριας αίτησης. Δεν είναι δυνατή η δημιουργία.");
            return null;
        }

        const maxKodikos = await this.getMaxAgrotemaxioKodikos();
        const newKodikos = maxKodikos + 1;

        const defaultAgroEntity = this._prepareAgrotemaxioEntityForRequest({ // Προετοιμασία για σωστή μορφή ID κλπ
            id: `TEMP_ID_${Date.now()}`,
                                                                           afm: currentEdehdEntity.afm,
                                                                           recordtype: 0,
                                                                           usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                                                                           kodikos: newKodikos,
                                                                           topothesia: "ΝΕΑ ΕΓΓΡΑΦΗ",
                                                                           neoxartoypob: "000000000000000",
                                                                           iemtype: 1,
                                                                           synidiopercent: 100,
                                                                           dikaiomataflag: 1,
                                                                           neoxartoypobFk: "UNDEFINED_VALUE",
                                                                           areaPhFk: -1,
                                                                           sexId: 40005,
                                                                           rowVersion: null,
                                                                           etos: this.EAE_YEAR,
                                                                           edeId: { id: this.MAIN_APPLICATION_ID }, // Βεβαιωθείτε ότι αυτό είναι εδώ
                                                                           ...newAgrotemaxioPartialData
        });
        if (!defaultAgroEntity.edeId) defaultAgroEntity.edeId = { id: this.MAIN_APPLICATION_ID }; // Double check

        const agrotemaxioChange = {
            status: 0,
            when: Date.now(),
            entityName: "Edetedeaeeagroi",
            entity: defaultAgroEntity
        };

        const edehdChange = {
            status: 1,
            when: 0,
            entityName: "Edetedeaeehd",
            entity: {
                ...currentEdehdEntity,
                rowVersion: currentEdehdEntity.rowVersion + 2
            }
        };

        try {
            const result = await this._synchronizeChanges([agrotemaxioChange, edehdChange]);
            console.log("Agrotemaxio created successfully:", result);
            alert("Το αγροτεμάχιο δημιουργήθηκε επιτυχώς!");
            return result;
        } catch (error) {
            console.error("Failed to create agrotemaxio:", error.data || error.message);
            alert(`Αποτυχία δημιουργίας αγροτεμαχίου: ${error.data ? error.data.message : error.message}`);
            return null;
        }
    }

    async updateAgrotemaxio(agrotemaxioIdToUpdate, changesToApply) {
        // ... (παρόμοιο με πριν, αλλά χρησιμοποιεί findAgrotemaxioById) ...
        console.log(`Attempting to update agrotemaxio ID: ${agrotemaxioIdToUpdate} with changes:`, changesToApply);

        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) {
            // ... χειρισμός σφάλματος ...
            return null;
        }

        const currentAgrotemaxioEntity = await this.findAgrotemaxioById(agrotemaxioIdToUpdate); // Αυτό επιστρέφει ήδη προετοιμασμένο entity
        if (!currentAgrotemaxioEntity) {
            // ... χειρισμός σφάλματος ...
            return null;
        }

        const updatedAgrotemaxioEntity = {
            ...currentAgrotemaxioEntity,
            ...changesToApply
        };
        // Προαιρετικά, ενημέρωση dteupdate/usrupdate αν χρειάζεται να σταλούν από τον client
        // updatedAgrotemaxioEntity.dteupdate = new Date().toISOString();
        // updatedAgrotemaxioEntity.usrupdate = currentEdehdEntity.usrinsert; // (ή όποιος είναι ο τρέχων χρήστης)

        const agrotemaxioChange = {
            status: 1,
            when: Date.now(),
            entityName: "Edetedeaeeagroi",
            entity: updatedAgrotemaxioEntity
        };

        const edehdChange = {
            status: 1,
            when: 0,
            entityName: "Edetedeaeehd",
            entity: {
                ...currentEdehdEntity,
                rowVersion: currentEdehdEntity.rowVersion + 2
            }
        };
        try {
            const result = await this._synchronizeChanges([agrotemaxioChange, edehdChange]);
            console.log("Agrotemaxio updated successfully:", result);
            alert("Το αγροτεμάχιο ενημερώθηκε επιτυχώς!");
            return result;
        } catch (error) {
            console.error("Failed to update agrotemaxio:", error.data || error.message);
            alert(`Αποτυχία ενημέρωσης αγροτεμαχίου: ${error.data ? error.data.message : error.message}`);
            return null;
        }
    }



    async fetchPAAList() {
        console.log("Fetching PAA list (Παρεμβάσεις Αγροτικής Ανάπτυξης)...");
        return this._fetchApi('Edetpaa/findAllByCriteriaRange_Edetedeaeehd_GrpEdaa_itm__eaaId?', 'POST', {
            gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 500
        }, true);
    }

    async fetchTomeakaList() {
        console.log("Fetching Tomeaka Programmata list (Επιχειρησιακά / Τομεακά Προγράμματα)...");
        return this._fetchApi('Edetpaa/findAllByCriteriaRange_Edetedeaeehd_GrpEdaaEp_itm__eaaId?', 'POST', {
            gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 500 // Προσαρμόστε το toRowIndex αν χρειάζεται
        }, true);
    }

    async fetchAmesesEnisxyseisList() {
        console.log("Fetching Ameses Enisxyseis list (Άμεσες Ενισχύσεις)...");
        return this._fetchApi('Edetsupportschema/findAllByCriteriaRange_Edetedeaeehd_eschID?', 'POST', {
            gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 500
        }, true);
    }

    async fetchEcoSchemeGroupsList() {
        console.log("Fetching Eco Scheme Groups list (Ομάδες Οικολογικών Σχημάτων)...");
        return this._fetchApi('EcoschemeGroup/findAllByCriteriaRange_Edetedeaeehd_esgrID?', 'POST', {
            gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 500
        }, true);
    }

    async fetchAvailableEcoSchemesForAgrotemaxio(agrotemaxioId) {
        console.log(`Fetching available Eco Schemes for agrotemaxio ID: ${agrotemaxioId}...`);
        return this._fetchApi('EcoschemeSubsidy/findAllByCriteriaRange_forMultInsertEdetedeaeeagroi_GrpEdaec?', 'POST', {
            gParams_yearEae: this.EAE_YEAR, edaId_id: agrotemaxioId, fromRowIndex: 0, toRowIndex: 500
        }, true);
    }

    async getKalliergiesForAgrotemaxio(agrotemaxioId) {
        console.log(`Fetching kalliergies (Edetedeaeefytiko) for agrotemaxio ID: ${agrotemaxioId}`);
        return this._fetchApi('Edetedeaeefytiko/findAllByCriteriaRange_EdetedeaeeagroiGrpEdf', 'POST', {
            edaId_id: agrotemaxioId, gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 100 // Προσαρμόστε
        }, true);
    }

    async getSyndedemenesForKalliergia(fytikoId) { // fytikoId είναι το ID του Edetedeaeefytiko
        console.log(`Fetching syndedemenes enisxyseis for fytiko ID: ${fytikoId}`);
        return this._fetchApi('Edetedeaeerequestfytiko/findAllByCriteriaRange_EdetedeaeeagroiGrpEfrq', 'POST', {
            edfId_id: fytikoId, gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 100 // Προσαρμόστε
        }, true);
    }

    async getPAAForAgrotemaxio(agrotemaxioId) {
        console.log(`Fetching PAA (Edetedeaeeagroipaa) for agrotemaxio ID: ${agrotemaxioId}`);
        return this._fetchApi('Edetedeaeeagroipaa/findAllByCriteriaRange_EdetedeaeeagroiGrpEdaaa', 'POST', {
            edaId_id: agrotemaxioId, gParams_yearEae: this.EAE_YEAR, fromRowIndex: 0, toRowIndex: 100
        }, true);
    }

    // --- Οικολογικά Σχήματα (Edetedeaeeagroieco) ---
    async getEcoSchemesForAgrotemaxio(agrotemaxioId) {
        console.log(`Fetching Eco Schemes (Edetedeaeeagroieco) for agrotemaxio ID: ${agrotemaxioId}`);
        return this._fetchApi('Edetedeaeeagroieco/findAllByCriteriaRange_EdetedeaeeagroiGrpEdaec', 'POST', {
            edaId_id: agrotemaxioId, /* gParams_yearEae δεν φαίνεται να χρειάζεται εδώ, αλλά το fromRowIndex */
            fromRowIndex: 0, toRowIndex: 500
        }, true);
    }

    /**
     * Γενική μέθοδος για προσθήκη μιας ή περισσότερων νέων υπο-οντοτήτων.
     * @param {Array<Object>} newEntitiesData - Πίνακας με αντικείμενα { entityName, entityData }.
     * @returns {Promise<Object|null>}
     */
    async _addRelatedEntities(newEntitiesData) {
        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) {
            console.error("Cannot add entities: Failed to fetch main application data.");
            return null;
        }

        const changes = newEntitiesData.map(item => ({
            status: 0, // Δημιουργία
            when: Date.now(),
                                                     entityName: item.entityName,
                                                     entity: item.entityData // Τα entityData πρέπει να είναι ήδη προετοιμασμένα
        }));

        changes.push({
            status: 1, when: 0, entityName: "Edetedeaeehd",
            entity: { ...currentEdehdEntity, rowVersion: currentEdehdEntity.rowVersion + 2 }
        });

        try {
            const result = await this._synchronizeChanges(changes);
            console.log(`${newEntitiesData.map(e=>e.entityName).join(', ')} added successfully:`, result);
            return result;
        } catch (error) {
            console.error(`Failed to add ${newEntitiesData.map(e=>e.entityName).join(', ')}:`, error.data || error.message);
            alert(`Αποτυχία προσθήκης: ${error.data ? error.data.message : error.message}`);
            return null;
        }
    }

   /**
     * Γενική μέθοδος για διαγραφή μιας ή περισσότερων υπο-οντοτήτων.
     * @param {Array<Object>} entitiesToDelete - Πίνακας με αντικείμενα { entityName, entityId, entityRowVersion (αν υπάρχει/χρειάζεται) }.
     * @returns {Promise<Object|null>}
    */
    async _deleteRelatedEntities(entitiesToDelete) {
        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) {
            console.error("Cannot delete entities: Failed to fetch main application data.");
            return null;
        }

        const changes = entitiesToDelete.map(item => ({
            status: 2, // Διαγραφή
            when: Date.now(), // Ή 0 αν ο server το προτιμά για διαγραφές
                                                      entityName: item.entityName,
                                                      entity: {
                                                          id: item.entityId,
                                                          rowVersion: item.entityRowVersion !== undefined ? item.entityRowVersion : null
                                                          // Ορισμένες διαγραφές μπορεί να μην χρειάζονται rowVersion για την υπο-οντότητα
                                                      }
        }));

        changes.push({
            status: 1, when: 0, entityName: "Edetedeaeehd",
            entity: { ...currentEdehdEntity, rowVersion: currentEdehdEntity.rowVersion + 2 }
        });

        try {
            const result = await this._synchronizeChanges(changes);
            console.log(`${entitiesToDelete.map(e=>e.entityName).join(', ')} deleted successfully:`, result);
            return result;
        } catch (error) {
            console.error(`Failed to delete ${entitiesToDelete.map(e=>e.entityName).join(', ')}:`, error.data || error.message);
            alert(`Αποτυχία διαγραφής: ${error.data ? error.data.message : error.message}`);
            return null;
        }
    }

    async addKalliergiaWithOptionalSyndedemeni(agrotemaxioId, kalliergiaData, syndedemeniData = null) {
        const currentEdehdData = await this.fetchMainApplicationData(); // Για το AFM κλπ.
        if(!currentEdehdData) return null;

        const newEntitiesToAdd = [];
        const tempFytikoId = `TEMP_ID_FYTIKO_${Date.now()}`;

        // Υπολογισμός επόμενου kodikos για Edetedeaeefytiko εντός του agrotemaxioId
        const existingKalliergies = await this.getKalliergiesForAgrotemaxio(agrotemaxioId);
        const nextFytikoKodikos = (existingKalliergies && existingKalliergies.length > 0)
        ? Math.max(0, ...existingKalliergies.map(k => parseInt(k.kodikos, 10) || 0)) + 1
        : 1;

        const fytikoEntityBase = {
            id: tempFytikoId,
            afm: currentEdehdData.afm,
            recordtype: 0,
            xptype: kalliergiaData.xptype || 1,
            kodikos: nextFytikoKodikos,
            dtedke: new Date().toISOString(),
            rowVersion: null,
            etos: this.EAE_YEAR,
            edeId: { id: this.MAIN_APPLICATION_ID },
            edaId: { id: agrotemaxioId },
            efyId: kalliergiaData.efyId, // πρέπει να είναι {id: '...'}
            poiId: kalliergiaData.poiId, // πρέπει να είναι {id: '...'}
            epilektash100: kalliergiaData.epilektash100 || 0,
            // ... άλλα απαραίτητα πεδία από kalliergiaData ή defaults ...
            sexId: kalliergiaData.sexId || currentEdehdData.sexId?.id || 40005, //Προσοχή εδώ
            lkkoiId: kalliergiaData.lkkoiId || (await this.findAgrotemaxioById(agrotemaxioId))?.lkkoiId?.id,
        };
        newEntitiesToAdd.push({
            entityName: "Edetedeaeefytiko",
            entityData: this._prepareFytikoEntityForRequest({...fytikoEntityBase, ...kalliergiaData})
        });

        if (syndedemeniData && syndedemeniData.eschId) {
            // Υπολογισμός επόμενου kodikos για Edetedeaeerequestfytiko εντός του fytikoId
            // (Αν και συνήθως υπάρχει μόνο ένα request ανά fytiko για μια συγκεκριμένη ενίσχυση)
            const nextRequestKodikos = 1; // Ας υποθέσουμε 1 για αρχή, θέλει έλεγχο αν μπορεί να έχει πολλαπλά

            const requestFytikoBase = {
                id: `TEMP_ID_REQFYTIKO_${Date.now()}`,
                afm: currentEdehdData.afm,
                recordtype: 0,
                kodikos: nextRequestKodikos,
                eschLt2: syndedemeniData.eschLt2 || 2,
                rowVersion: null,
                etos: this.EAE_YEAR,
                edeId: { id: this.MAIN_APPLICATION_ID },
                edaId: { id: agrotemaxioId },
                edfId: { id: tempFytikoId },
                efyId: kalliergiaData.efyId, // Από την καλλιέργεια
                poiId: kalliergiaData.poiId, // Από την καλλιέργεια
                eschId: syndedemeniData.eschId, // πρέπει να είναι {id: '...'}
                sexId: {id: currentEdehdData.sexId?.id || "99gZmMPS9BTTkHuUFInwyw=="},
            };
            newEntitiesToAdd.push({
                entityName: "Edetedeaeerequestfytiko",
                entityData: this._prepareRequestFytikoEntityForRequest({...requestFytikoBase, ...syndedemeniData})
            });
        }
        return this._addRelatedEntities(newEntitiesToAdd);
    }

    async deleteKalliergiaFromAgrotemaxio(kalliergiaId, agrotemaxioIdForContext) { // Χρειαζόμαστε το agrotemaxioId για να βρούμε το fytiko
        this._log(`Attempting to delete kalliergia ID: ${kalliergiaId} (and its syndedemenes) from agrotemaxio ID: ${agrotemaxioIdForContext}`);
        const syndedemenes = await this.getSyndedemenesForKalliergia(kalliergiaId);
        const entitiesToDelete = [];
        syndedemenes.forEach(s => {
            entitiesToDelete.push({ entityName: "Edetedeaeerequestfytiko", entityId: s.id, entityRowVersion: s.rowVersion });
        });

        // Για τη διαγραφή του Edetedeaeefytiko, χρειαζόμαστε το rowVersion του, αν ο server το απαιτεί.
        // Ας υποθέσουμε ότι το έχουμε ή ότι το _deleteRelatedEntities το χειρίζεται αν είναι null.
        const allKalliergiesOfAgro = await this.getKalliergiesForAgrotemaxio(agrotemaxioIdForContext);
        const fytikoToDelete = allKalliergiesOfAgro.find(k => k.id === kalliergiaId);

        entitiesToDelete.push({
            entityName: "Edetedeaeefytiko",
            entityId: kalliergiaId,
            entityRowVersion: fytikoToDelete ? fytikoToDelete.rowVersion : null
        });

        if (entitiesToDelete.length === 0 || !fytikoToDelete) { // Αν δεν βρέθηκε το fytiko ή δεν είχε συνδεδεμένες
             if(!fytikoToDelete && entitiesToDelete.some(e => e.entityName === "Edetedeaeefytiko")){
                this._warn("Kalliergia to delete not found in agrotemaxio's list. Cannot get its rowVersion if needed. Proceeding with delete request anyway for ID:", kalliergiaId);
             } else if(entitiesToDelete.length === 0){
                this._warn("No entities to delete for kalliergiaId (already deleted or no syndedemenes?):", kalliergiaId);
                return {info: "Nothing to delete or already deleted."};
             }
        }
        return this._deleteRelatedEntities(entitiesToDelete);
    }

    async addPAAToAgrotemaxio(agrotemaxioId, paaId) { // paaId είναι το ID του Edetpaa
        console.log(`Adding PAA ID: ${paaId} to agrotemaxio ID: ${agrotemaxioId}`);
        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) return null;

        const agroPaaEntity = this._prepareEntityForRequest({
            id: `TEMP_ID_AGROPAA_${Date.now()}`,
                                                            afm: currentEdehdEntity.afm,
                                                            recordtype: 0,
                                                            kodikos: 1, // Πιθανόν χρειάζεται max + 1 για το agrotemaxio
                                                            eaaLt2: 1, // Φαίνεται default
                                                            rowVersion: null,
                                                            datasourcetype: 2, // Φαίνεται default
                                                            etos: this.EAE_YEAR,
                                                            edeId: { id: this.MAIN_APPLICATION_ID },
                                                            edaId: { id: agrotemaxioId },
                                                            eaaId: { id: paaId }, // Το ID του ΠΑΑ
                                                            sexId: null // (ή το sexId του χρήστη αν απαιτείται)
        }, [], [{field: 'eaaId'}]);

        const changes = [
            { status: 0, when: Date.now(), entityName: "Edetedeaeeagroipaa", entity: agroPaaEntity },
            { status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehdEntity, rowVersion: currentEdehdEntity.rowVersion + 2 } }
        ];
        try {
            const result = await this._synchronizeChanges(changes);
            console.log("PAA added to agrotemaxio:", result);
            alert("Το μέτρο ΠΑΑ προστέθηκε επιτυχώς!");
            return result;
        } catch (error) {
            console.error("Failed to add PAA to agrotemaxio:", error.data || error.message);
            alert(`Αποτυχία προσθήκης μέτρου ΠΑΑ: ${error.data ? error.data.message : error.message}`);
            return null;
        }
    }

    async deletePAAFromAgrotemaxio(agroPaaId) {
        return this._deleteRelatedEntities([{ entityName: "Edetedeaeeagroipaa", entityId: agroPaaId }]);
    }

    async addEcoSchemesToAgrotemaxio(agrotemaxioId, ecoSchemeSubsidyIds = []) { // Array από IDs των EcoschemeSubsidy
        console.log(`Adding Eco Scheme IDs: ${ecoSchemeSubsidyIds.join(', ')} to agrotemaxio ID: ${agrotemaxioId}`);
        if (!ecoSchemeSubsidyIds || ecoSchemeSubsidyIds.length === 0) {
            console.warn("No eco scheme IDs provided.");
            return null;
        }
        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) return null;

        const changes = [];
        // Βρίσκουμε τον τρέχοντα μέγιστο kodikos για τα eco schemes αυτού του αγροτεμαχίου
        const existingEcoSchemes = await this.getEcoSchemesForAgrotemaxio(agrotemaxioId);
        let currentMaxEcoKodikos = 0;
        if (existingEcoSchemes && existingEcoSchemes.length > 0) {
            currentMaxEcoKodikos = Math.max(0, ...existingEcoSchemes.map(e => parseInt(e.kodikos,10) || 0));
        }

        ecoSchemeSubsidyIds.forEach((essuId, index) => {
            currentMaxEcoKodikos++;
            const agroEcoEntity = this._prepareEntityForRequest({
                id: `TEMP_ID_AGROECO_${Date.now()}_${index}`,
                                                                afm: currentEdehdEntity.afm,
                                                                recordtype: 0,
                                                                kodikos: currentMaxEcoKodikos, // Αυξητικός κωδικός για το συγκεκριμένο αγροτεμάχιο
                                                                rowVersion: null,
                                                                datasourcetype: 2, // Φαίνεται default
                                                                etos: this.EAE_YEAR,
                                                                edeId: { id: this.MAIN_APPLICATION_ID },
                                                                edaId: { id: agrotemaxioId },
                                                                essuId: { id: essuId }, // Το ID του EcoschemeSubsidy
                                                                sexId: null // (ή το sexId του χρήστη αν απαιτείται)
            }, [], [{field: 'essuId'}]);
            changes.push({ status: 0, when: Date.now(), entityName: "Edetedeaeeagroieco", entity: agroEcoEntity });
        });

        if (changes.length > 0) {
            changes.push({ status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehdEntity, rowVersion: currentEdehdEntity.rowVersion + 2 } });
            try {
                const result = await this._synchronizeChanges(changes);
                console.log("Eco Schemes added to agrotemaxio:", result);
                alert("Τα οικολογικά σχήματα προστέθηκαν επιτυχώς!");
                return result;
            } catch (error) {
                console.error("Failed to add Eco Schemes to agrotemaxio:", error.data || error.message);
                alert(`Αποτυχία προσθήκης οικολογικών σχημάτων: ${error.data ? error.data.message : error.message}`);
                return null;
            }
        }
        return null;
    }

    async getEcoSchemesForAgrotemaxio(agrotemaxioId) {
        console.log(`Fetching Eco Schemes (Edetedeaeeagroieco) for agrotemaxio ID: ${agrotemaxioId}`);
        return this._fetchApi('Edetedeaeeagroieco/findAllByCriteriaRange_EdetedeaeeagroiGrpEdaec', 'POST', {
            edaId_id: agrotemaxioId, /* gParams_yearEae δεν φαίνεται να χρειάζεται εδώ, αλλά το fromRowIndex */
            fromRowIndex: 0, toRowIndex: 500
        }, true);
    }

    async deleteEcoSchemeFromAgrotemaxio(agroEcoId) {
        return this._deleteRelatedEntities([{ entityName: "Edetedeaeeagroieco", entityId: agroEcoId }]);
    }


    // --- Συνάρτηση Αντιγραφής (Βελτιωμένη) ---
    /**
     * Αντιγράφει επιλεγμένα δεδομένα από ένα αγροτεμάχιο-πηγή σε ένα ή περισσότερα αγροτεμάχια-στόχους.
     * @param {string} sourceAgrotemaxioId
     * @param {Array<string>} targetAgrotemaxioIds
     * @param {Object} dataToCloneConfig - π.χ., { kalliergies: true, paa: false, ecoschemes: true }
     * @param {'overwrite'|'append'} strategy - Προς το παρόν υποστηρίζεται μόνο το 'overwrite'.
     */
    async cloneAgrotemaxioData(sourceAgrotemaxioId, targetAgrotemaxioIds, dataToCloneConfig, strategy = 'overwrite') {
        if (strategy !== 'overwrite') {
            this._error("Clone strategy not implemented:", strategy);
            throw new Error(`Currently only 'overwrite' strategy is implemented for cloning. Strategy '${strategy}' is not supported.`);
        }
        this._log(`Cloning data from source ${sourceAgrotemaxioId} to targets ${targetAgrotemaxioIds.join(', ')} with config:`, dataToCloneConfig);

        let initialEdehd = await this.fetchMainApplicationData();
        if (!initialEdehd) {
            this._error("Cannot start clone: Failed to fetch initial main application data.");
            return { success: false, message: "Failed to fetch initial main application data." };
        }

        // 1. Λήψη δεδομένων από την πηγή (μία φορά)
        const sourceData = {};
        this._log(`Fetching all source data from agrotemaxio ID: ${sourceAgrotemaxioId}`);
        if (dataToCloneConfig.kalliergies) {
            sourceData.kalliergies = await this.getKalliergiesForAgrotemaxio(sourceAgrotemaxioId);
            sourceData.syndedemenes = {};
            if (sourceData.kalliergies) {
                for (const fytiko of sourceData.kalliergies) {
                    sourceData.syndedemenes[fytiko.id] = await this.getSyndedemenesForKalliergia(fytiko.id);
                }
            }
             this._log("Source Kalliergies & Syndedemenes fetched.");
        }
        if (dataToCloneConfig.paa) {
            sourceData.paa = await this.getPAAForAgrotemaxio(sourceAgrotemaxioId);
            this._log("Source PAA fetched.");
        }
        if (dataToCloneConfig.ecoschemes) {
            sourceData.ecoschemes = await this.getEcoSchemesForAgrotemaxio(sourceAgrotemaxioId);
            this._log("Source EcoSchemes fetched.");
        }

        const results = {};

        for (const targetId of targetAgrotemaxioIds) {
            if (targetId === sourceAgrotemaxioId) {
                this._warn(`Skipping clone to self: ${targetId}`);
                results[targetId] = { success: true, skipped: true, message: "Skipped self-cloning." };
                continue;
            }
            this._log(`Processing target agrotemaxio: ${targetId}`);

            // Για κάθε target, ξεκινάμε με το πιο πρόσφατο Edehd
            let currentEdehdForTarget = await this.fetchMainApplicationData();
            if (!currentEdehdForTarget) {
                this._error(`Failed to fetch Edehd for target ${targetId}. Skipping.`);
                results[targetId] = { success: false, message: `Failed to fetch Edehd for target ${targetId}.` };
                continue;
            }

            const batchOperations = [];

            // 2. Προετοιμασία διαγραφών (αν 'overwrite')
            if (strategy === 'overwrite') {
                this._log(`Overwrite strategy: Preparing deletions for target ${targetId}`);
                if (dataToCloneConfig.kalliergies) {
                    const targetKalliergies = await this.getKalliergiesForAgrotemaxio(targetId);
                    if (targetKalliergies) {
                        for (const fytiko of targetKalliergies) {
                            const targetSyndedemenes = await this.getSyndedemenesForKalliergia(fytiko.id);
                            if (targetSyndedemenes) {
                                targetSyndedemenes.forEach(s => batchOperations.push({ status: 2, when: Date.now(), entityName: "Edetedeaeerequestfytiko", entity: { id: s.id, rowVersion: s.rowVersion } }));
                            }
                            batchOperations.push({ status: 2, when: Date.now(), entityName: "Edetedeaeefytiko", entity: { id: fytiko.id, rowVersion: fytiko.rowVersion } });
                        }
                    }
                }
                if (dataToCloneConfig.paa) {
                    const targetPaas = await this.getPAAForAgrotemaxio(targetId);
                    if (targetPaas) targetPaas.forEach(p => batchOperations.push({ status: 2, when: Date.now(), entityName: "Edetedeaeeagroipaa", entity: { id: p.id, rowVersion: p.rowVersion } }));
                }
                if (dataToCloneConfig.ecoschemes) {
                    const targetEcos = await this.getEcoSchemesForAgrotemaxio(targetId);
                    if (targetEcos) targetEcos.forEach(e => batchOperations.push({ status: 2, when: Date.now(), entityName: "Edetedeaeeagroieco", entity: { id: e.id, rowVersion: e.rowVersion } }));
                }
            }

            // 3. Προετοιμασία προσθηκών
            this._log(`Preparing additions for target ${targetId}`);
            let fytikoKodikosCounter = 0; // Αυτά πρέπει να είναι ανά target, οπότε τα μηδενίζουμε εδώ
            let paaKodikosCounter = 0;
            let ecoKodikosCounter = 0;

            // Λήψη των υπαρχόντων kodikoi για το target για να συνεχίσουμε από εκεί
             if (dataToCloneConfig.kalliergies && sourceData.kalliergies) {
                const existingTargetKalliergies = strategy === 'overwrite' ? [] : await this.getKalliergiesForAgrotemaxio(targetId);
                fytikoKodikosCounter = existingTargetKalliergies.length > 0 ? Math.max(0, ...existingTargetKalliergies.map(k => parseInt(k.kodikos,10) || 0)) : 0;
            }
            if (dataToCloneConfig.paa && sourceData.paa) {
                const existingTargetPaas = strategy === 'overwrite' ? [] : await this.getPAAForAgrotemaxio(targetId);
                paaKodikosCounter = existingTargetPaas.length > 0 ? Math.max(0, ...existingTargetPaas.map(p => parseInt(p.kodikos,10) || 0)) : 0;
            }
            if (dataToCloneConfig.ecoschemes && sourceData.ecoschemes) {
                const existingTargetEcos = strategy === 'overwrite' ? [] : await this.getEcoSchemesForAgrotemaxio(targetId);
                ecoKodikosCounter = existingTargetEcos.length > 0 ? Math.max(0, ...existingTargetEcos.map(e => parseInt(e.kodikos,10) || 0)) : 0;
            }


            if (dataToCloneConfig.kalliergies && sourceData.kalliergies) {
                for (const srcFytiko of sourceData.kalliergies) {
                    fytikoKodikosCounter++;
                    const tempNewFytikoId = `TEMP_CLONE_FYT_${targetId}_${Date.now()}_${fytikoKodikosCounter}`;

                    const newFytikoEntityData = {
                        ...srcFytiko,
                        id: tempNewFytikoId,
                        edaId: { id: targetId },
                        edeId: { id: this.MAIN_APPLICATION_ID },
                        kodikos: fytikoKodikosCounter,
                        rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                        epilektash100: srcFytiko.epilektash100 || 0, // Αντιγραφή έκτασης πηγής, ή 0/null.
                                                                     // Εναλλακτικά, μπορεί να οριστεί πάντα σε 0/null εδώ.
                    };
                    batchOperations.push({ status: 0, when: Date.now(), entityName: "Edetedeaeefytiko", entity: this._prepareFytikoEntityForRequest(newFytikoEntityData) });

                    const srcSyndedemenes = sourceData.syndedemenes[srcFytiko.id] || [];
                    let syndedemeniKodikosCounter = 0;
                    for (const srcSyndedemeni of srcSyndedemenes) {
                        syndedemeniKodikosCounter++;
                        const newSyndedemeniEntityData = {
                            ...srcSyndedemeni,
                            id: `TEMP_CLONE_REQ_${targetId}_${Date.now()}_${syndedemeniKodikosCounter}`,
                            edaId: { id: targetId }, edeId: { id: this.MAIN_APPLICATION_ID },
                            edfId: { id: tempNewFytikoId },
                            kodikos: syndedemeniKodikosCounter,
                            rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                        };
                        batchOperations.push({ status: 0, when: Date.now(), entityName: "Edetedeaeerequestfytiko", entity: this._prepareRequestFytikoEntityForRequest(newSyndedemeniEntityData) });
                    }
                }
            }

            if (dataToCloneConfig.paa && sourceData.paa) {
                for (const srcPaa of sourceData.paa) {
                    paaKodikosCounter++;
                    const newPaaEntityData = { /* ... παρόμοια με fytiko ... */
                        ...srcPaa, id: `TEMP_CLONE_PAA_${targetId}_${Date.now()}_${paaKodikosCounter}`,
                        edaId: { id: targetId }, edeId: { id: this.MAIN_APPLICATION_ID }, kodikos: paaKodikosCounter,
                        rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                    };
                    batchOperations.push({ status: 0, when: Date.now(), entityName: "Edetedeaeeagroipaa", entity: this._prepareAgroPaaEntityForRequest(newPaaEntityData) });
                }
            }

            if (dataToCloneConfig.ecoschemes && sourceData.ecoschemes) {
                for (const srcEco of sourceData.ecoschemes) {
                    ecoKodikosCounter++;
                    const newEcoEntityData = { /* ... παρόμοια με fytiko ... */
                        ...srcEco, id: `TEMP_CLONE_ECO_${targetId}_${Date.now()}_${ecoKodikosCounter}`,
                        edaId: { id: targetId }, edeId: { id: this.MAIN_APPLICATION_ID }, kodikos: ecoKodikosCounter,
                        rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                    };
                    batchOperations.push({ status: 0, when: Date.now(), entityName: "Edetedeaeeagroieco", entity: this._prepareAgroEcoEntityForRequest(newEcoEntityData) });
                }
            }

            // 4. Εκτέλεση Batch Λειτουργιών (Διαγραφές + Προσθήκες + Ενημέρωση Edehd)
            if (batchOperations.length > 0) {
                batchOperations.push({
                    status: 1, when: 0, entityName: "Edetedeaeehd",
                    entity: { ...currentEdehdForTarget, rowVersion: currentEdehdForTarget.rowVersion + 2 }
                });

                this._log(`Executing batch of ${batchOperations.length -1} operations (+ Edehd update) for target ${targetId}`);
                try {
                    const batchResult = await this._synchronizeChanges(batchOperations);
                    this._log(`Batch operations for target ${targetId} successful.`);
                    results[targetId] = { success: true, message: "Cloned successfully.", details: batchResult };
                } catch (error) {
                    this._error(`Batch operations for target ${targetId} failed:`, error.data || error.message);
                    results[targetId] = { success: false, message: `Clone failed: ${error.data ? error.data.message : error.message}`, errorData: error.data };
                    // Αν αποτύχει, το rowVersion του Edehd δεν θα έχει αλλάξει (θεωρητικά),
                    // οπότε το currentEdehdForTarget είναι ακόμα έγκυρο για το επόμενο target (αν και το επόμενο target θα ξανακάνει fetch).
                }
            } else {
                this._log(`No operations to perform for target ${targetId}.`);
                results[targetId] = { success: true, skipped: true, message: "No data to clone or no operations configured."};
            }
        } // end for targetId

        this._log("Cloning process completed for all targets.");
        return results;
    }
}

// --- Παράδειγμα Χρήσης για τη συνάρτηση cloneAgrotemaxioData ---


// (async () => {
//     const MY_MAIN_APP_ID ="qB8ujfgfAKWoOF+W1gH/Ow==";
//     const CURRENT_EAE_YEAR = 2025;
//     const agroHelper = new OpekepeAgroHelper(MY_MAIN_APP_ID, CURRENT_EAE_YEAR);

//     const allAgros = await agroHelper.fetchAllAgrotemaxia(10);
//     if (allAgros.length < 2) {
//         console.warn("Need at least two agrotemaxia to test cloning.");
//         // Optionally create some:
//         // await agroHelper.createAgrotemaxio({ topothesia: "Πηγή Κλωνοποίησης"});
//         // await agroHelper.createAgrotemaxio({ topothesia: "Στόχος Κλωνοποίησης 1"});
//         // const updatedAgros = await agroHelper.fetchAllAgrotemaxia(10);
//         // if (updatedAgros.length < 2) return;
//         // sourceId = updatedAgros[0].id;
//         // targetIds = [updatedAgros[1].id];
//         return;
//     }

//     const sourceId = allAgros[0].id;
//     const targetIds = [allAgros[1].id];
//     if (allAgros.length > 2) targetIds.push(allAgros[2].id); // Αν υπάρχουν περισσότερα

//     console.log(`Source Agrotemaxio ID: ${sourceId}`);
//     console.log(`Target Agrotemaxio IDs: ${targetIds.join(', ')}`);

//     // Πρώτα, προσθήκη κάποιων δεδομένων στο source για να έχουμε τι να αντιγράψουμε
//     // (Αυτό είναι για λόγους επίδειξης - στην πράξη, τα δεδομένα θα υπάρχουν)
//     console.log("Adding some data to source agrotemaxio for cloning demonstration...");
//     const amesesList = await agroHelper.fetchAmesesEnisxyseisList();
//     const sklirosSitosEnisxysiDemo = amesesList.find(s => s.kodikos === "0102");
//     if (sklirosSitosEnisxysiDemo) {
//         await agroHelper.addKalliergiaWithOptionalSyndedemeni(
//             sourceId,
//             { epilektash100: 10.5, efyId: { id: "VMxnJnQisDYspssypbAjjA==" }, poiId: { id: "Zu50wPtrta9nV1CJTP3nkQ==" } },
//             { eschId: { id: sklirosSitosEnisxysiDemo.id } }
//         );
//     }
//     const paaList = await agroHelper.fetchPAAList();
//     const paaDemo = paaList.find(p => p.kodikos === "10.1.4Β");
//     if (paaDemo) {
//         await agroHelper.addPAAToAgrotemaxio(sourceId, paaDemo.id);
//     }


//     console.log("\n--- Starting Clone Operation ---");
//     await agroHelper.cloneAgrotemaxioData(
//         sourceId,
//         targetIds,
//         { kalliergies: true, paa: true, ecoschemes: false }, // Αντιγραφή καλλιεργειών/συνδεδεμένων και ΠΑΑ, όχι Οικολογικών Σχημάτων
//         'overwrite'
//     );

//     // Έλεγχος των target αγροτεμαχίων
//     for (const target of targetIds) {
//         console.log(`\n--- Data for Target Agrotemaxio ID: ${target} AFTER CLONE ---`);
//         const kalliergies = await agroHelper.getKalliergiesForAgrotemaxio(target);
//         console.log("Kalliergies:", kalliergies);
//         if (kalliergies && kalliergies.length > 0) {
//             for(const k of kalliergies){
//                 const synd = await agroHelper.getSyndedemenesForKalliergia(k.id);
//                 console.log(`  Syndedemenes for fytiko ${k.id}:`, synd);
//             }
//         }
//         const paas = await agroHelper.getPAAForAgrotemaxio(target);
//         console.log("PAAs:", paas);
//         const ecos = await agroHelper.getEcoSchemesForAgrotemaxio(target);
//         console.log("EcoSchemes:", ecos);
//     }

// })();
