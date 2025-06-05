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
        // ... (Λογική μετατροπής ημερομηνιών παραμένει ίδια) ...
        if (!entity) return null;
        const GREEK_MONTHS = ["ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΙ", "ΙΟΥΝ", "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ"];

        const preparedEntity = { ...entity };
        delete preparedEntity.$entityName;
        delete preparedEntity.$refId;

        dateFieldsToConvert.forEach(field => { /* ... */ });

        idFieldsToSimplify.forEach(key => {
            const idField = key.field;
            const idKey = key.idKey || 'id';
            let fieldValue = preparedEntity[idField]; // Δουλεύουμε με αντίγραφο

            if (fieldValue === null || fieldValue === undefined) {
                preparedEntity[idField] = null; // Εξασφάλιση null αν λείπει
            } else if (typeof fieldValue === 'object') {
                if (fieldValue[idKey] !== undefined && fieldValue[idKey] !== null) {
                    preparedEntity[idField] = { [idKey]: fieldValue[idKey] };
                } else if (fieldValue["$refId"] !== undefined && fieldValue["$refId"] !== null) {
                    preparedEntity[idField] = { [idKey]: fieldValue["$refId"] };
                } else {
                    this._warn(`Object for ID field ${idField} does not have valid '${idKey}' or '$refId'. Setting to null. Object was:`, fieldValue);
                    preparedEntity[idField] = null;
                }
            } else { // Είναι απλή τιμή (string/number)
                preparedEntity[idField] = { [idKey]: fieldValue };
            }
        });
        return preparedEntity;
    }


    _prepareEdehdEntityForRequest(serverEdehdEntity) {
        const dateFields = ['dteinsert', 'dteupdate', 'dtebirth', 'dteprotocol', 'dtestartekm', 'dteasfalish', 'dtedraststart', 'dteonlineproseas', 'dteOris'];
        const idFields = [
            { field: 'lkkoiIdB1', idKey: 'id'}, { field: 'doyId', idKey: 'id' }, { field: 'efoId', idKey: 'id' },
            { field: 'lkpenIdA', idKey: 'id' }, // Το κρίσιμο πεδίο
            { field: 'edeIdPrev', idKey: 'id' }, { field: 'edeIdNext', idKey: 'id' },
            { field: 'lkpenIdB1', idKey: 'id' }, { field: 'lkpenIdB2', idKey: 'id' },
            { field: 'lkkoiIdB2', idKey: 'id' },
            { field: 'bnkId', idKey: 'id'}, { field: 'bnsId', idKey: 'id' },
            { field: 'daokKodikos', idKey: 'kodikos' }, { field: 'opdId', idKey: 'id' },
            { field: 'ddsId', idKey: 'id' }, { field: 'ddrId', idKey: 'id' }, { field: 'lkprfId', idKey: 'id' },
            { field: 'mcoKodikos', idKey: 'id'}, // Υποθέτω ότι είναι ID, αν είναι kodikos άλλαξέ το
            { field: 'orgId', idKey: 'id'},
            { field: 'lkprfIdB2', idKey: 'id' },
            { field: 'nmrId', idKey: 'id'}, { field: 'ownerSexId', idKey: 'id' }, { field: 'sexId', idKey: 'id' },
            { field: 'depId', idKey: 'id'}, { field: 'edeIdPraxis', idKey: 'id' },
            { field: 'esapId', idKey: 'id'}, { field: 'edskId', idKey: 'id' }
        ];
        return this._prepareEntityForRequest(serverEdehdEntity, dateFields, idFields);
    }


    _prepareAgrotemaxioEntityForRequest(serverEntity) {
        const prepared = this._prepareEntityForRequest(serverEntity,
            ['dteinsert', 'dteupdate', 'dteensEpil', 'dteEnsPe', 'dteprotocolEda'],
            [
                {field: 'edeId', idKey: 'id'}, // Προστέθηκε για να τυποποιηθεί
                {field: 'lkkoiId', idKey: 'id'},
                {field: 'sexIdOther', idKey: 'id'},
                {field: 'edelId', idKey: 'id'}
            ]
        );
        if (prepared) {
            // Ειδικός χειρισμός για edeId αν δεν το έπιασε σωστά η γενική μέθοδος
            if (!prepared.edeId || (typeof prepared.edeId === 'object' && (prepared.edeId.id === null || prepared.edeId.id === undefined))) {
                 prepared.edeId = { id: this.MAIN_APPLICATION_ID };
            }
            // Το sexId στο αγροτεμάχιο είναι αριθμός
            if (typeof prepared.sexId === 'object' && prepared.sexId && prepared.sexId.id !== undefined) {
                prepared.sexId = parseInt(prepared.sexId.id, 10); // Κάνε το parse σε αριθμό
                if(isNaN(prepared.sexId)) prepared.sexId = null; // Αν δεν είναι αριθμός, null
            } else if (typeof prepared.sexId === 'string' && !isNaN(parseInt(prepared.sexId,10))){
                prepared.sexId = parseInt(prepared.sexId,10);
            }
        }
        return prepared;
    }

    _prepareFytikoEntityForRequest(serverEntity) {
        const prepared = this._prepareEntityForRequest(serverEntity,
            ['dteinsert', 'dteupdate', 'dteepisporhapo', 'dteepisporheos', 'dtedke'],
            [ // Τα IDs που πρέπει να είναι αντικείμενα {id: ...}
                {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
                {field: 'efyId', idKey: 'id', required: true}, {field: 'poiId', idKey: 'id', required: true},
                {field: 'emxpId', idKey: 'id'},
                // Αφαιρέθηκε το lkkoiId από εδώ γιατί πρέπει να είναι αριθμός
            ]
        );
        if (prepared) {
            // Το lkkoiId στο Edetedeaeefytiko πρέπει να είναι ΑΡΙΘΜΟΣ (kodikos) ή null.
            if (prepared.lkkoiId && typeof prepared.lkkoiId === 'object' && prepared.lkkoiId.id !== undefined) {
                // Αν η _prepareEntityForRequest το έκανε {id: ...}, πάρε την τιμή και κάν' την parse.
                prepared.lkkoiId = parseInt(prepared.lkkoiId.id, 10);
            } else if (typeof prepared.lkkoiId === 'string') {
                prepared.lkkoiId = parseInt(prepared.lkkoiId, 10);
            }
            if (isNaN(prepared.lkkoiId)) {
                prepared.lkkoiId = null;
            }

            // Το sexId στο fytiko είναι αριθμός
            if (typeof prepared.sexId === 'object' && prepared.sexId && prepared.sexId.id !== undefined) {
                prepared.sexId = parseInt(prepared.sexId.id, 10);
                 if(isNaN(prepared.sexId)) prepared.sexId = null;
            } else if (typeof prepared.sexId === 'string' && !isNaN(parseInt(prepared.sexId,10))){
                prepared.sexId = parseInt(prepared.sexId,10);
            }
        }
        return prepared;
    }

    _prepareRequestFytikoEntityForRequest(serverEntity) {
        const prepared = this._prepareEntityForRequest(serverEntity,
            ['dteinsert', 'dteupdate'],
            [
                {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
                {field: 'edfId', idKey: 'id', required: true}, {field: 'efyId', idKey: 'id', required: true},
                {field: 'poiId', idKey: 'id', required: true}, {field: 'eschId', idKey: 'id', required: true},
                {field: 'sexId', idKey: 'id', required: true} // Αυτό είναι το Subscriber ID, οπότε {id: "string"} είναι σωστό
            ]
        );
        // Δεν χρειάζεται ειδικός χειρισμός για sexId εδώ, η γενική μέθοδος θα το κάνει {id: "..."}
        return prepared;
    }

    _prepareAgroEcoEntityForRequest(serverEntity) {
        const prepared = this._prepareEntityForRequest(serverEntity,
           ['dteinsert', 'dteupdate'],
           [
               {field: 'edeId', idKey: 'id', required: true}, {field: 'edaId', idKey: 'id', required: true},
               {field: 'essuId', idKey: 'id', required: true}
                // Το sexId στο agroEco συνήθως είναι null ή δεν στέλνεται
           ]
       );
       if (prepared && prepared.sexId && typeof prepared.sexId === 'object' && prepared.sexId.id !== undefined) {
           prepared.sexId = prepared.sexId.id;
       } else if (prepared && prepared.sexId === undefined) {
           prepared.sexId = null;
       }
       return prepared;
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
        if (this.VERBOSE) {
            this._log("Synchronizing changes with payload (showing entity names, statuses, and temp/db IDs):");
            dataPayloadArray.forEach((item, index) => {
                this._log(`Item ${index}: Name=${item.entityName}, Status=${item.status}, ID=${item.entity.id}`);
            });
            // Για πλήρες debugging του payload:
            // this._log("Full payload to be sent:", JSON.stringify(payload, null, 2));
        }
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
        this._log(`Attempting to add kalliergia to agro ID: ${agrotemaxioId}`, {kalliergiaData, syndedemeniData});
        const currentEdehdData = await this.fetchMainApplicationData();
        if (!currentEdehdData) {
            this._error("Cannot add kalliergia: Main application data fetch failed.");
            return null;
        }

        const newEntitiesToAdd = [];
        const tempFytikoId = `TEMP_ID_FYTIKO_${Date.now()}`;

        const existingKalliergies = await this.getKalliergiesForAgrotemaxio(agrotemaxioId);
        const nextFytikoKodikos = (existingKalliergies && existingKalliergies.length > 0)
            ? Math.max(0, ...existingKalliergies.map(k => parseInt(k.kodikos, 10) || 0)) + 1
            : 1;
        this._log("Next fytiko kodikos for this agrotemaxio will be:", nextFytikoKodikos);

        let fytikoLkkoiId = null;
        if (kalliergiaData.lkkoiId !== undefined) {
            if (typeof kalliergiaData.lkkoiId === 'number') {
                fytikoLkkoiId = kalliergiaData.lkkoiId;
            } else if (typeof kalliergiaData.lkkoiId === 'string' && !isNaN(parseInt(kalliergiaData.lkkoiId, 10))) {
                fytikoLkkoiId = parseInt(kalliergiaData.lkkoiId, 10);
            } else if (typeof kalliergiaData.lkkoiId === 'object' && kalliergiaData.lkkoiId !== null && kalliergiaData.lkkoiId.id !== undefined) {
                 // Αν είναι {id: αριθμός_ως_string}, προσπάθησε να το κάνεις parse
                fytikoLkkoiId = parseInt(kalliergiaData.lkkoiId.id, 10);
                if(isNaN(fytikoLkkoiId)) fytikoLkkoiId = null;
            } else {
                this._warn("lkkoiId for Fytiko has an unexpected format:", kalliergiaData.lkkoiId, ". Will try to get from agrotemaxio.");
            }
        }

        if (fytikoLkkoiId === null) { // Αν δεν δόθηκε ή δεν μπόρεσε να γίνει parse, πάρε το από το αγροτεμάχιο
            const rawAgroDetails = (await this.fetchAllAgrotemaxia()).find(a => a.id === agrotemaxioId);
            if (rawAgroDetails && rawAgroDetails.lkkoiId && rawAgroDetails.lkkoiId.kodikos) {
                fytikoLkkoiId = parseInt(rawAgroDetails.lkkoiId.kodikos, 10);
                 if(isNaN(fytikoLkkoiId)) fytikoLkkoiId = null;
            }
        }
        this._log("Final lkkoiId for Fytiko entity:", fytikoLkkoiId);


        const fytikoEntityBase = {
            id: tempFytikoId,
            afm: currentEdehdData.afm,
            recordtype: 0,
            xptype: 1, // default
            kodikos: nextFytikoKodikos,
            dtedke: new Date().toISOString(),
            rowVersion: null,
            etos: this.EAE_YEAR,
            edeId: this.MAIN_APPLICATION_ID, // Στέλνουμε απευθείας το ID string
            edaId: agrotemaxioId,         // Στέλνουμε απευθείας το ID string
            efyId: kalliergiaData.efyId,   // Περιμένουμε να είναι {id: '...'} ή string ID
            poiId: kalliergiaData.poiId,   // Περιμένουμε να είναι {id: '...'} ή string ID
            emxpId: kalliergiaData.emxpId, // Περιμένουμε να είναι {id: '...'} ή string ID
            epilektash100: parseFloat(kalliergiaData.epilektash100) || 0,
            sexId: kalliergiaData.sexId !== undefined ? kalliergiaData.sexId : (currentEdehdData.ownerSexId?.id ? parseInt(currentEdehdData.ownerSexId.id) : 40005), // Δοκίμασε ownerSexId ή default
            lkkoiId: fytikoLkkoiId,
            // Αφαίρεση των audit πεδίων, ο server τα βάζει
            usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null
        };
        const finalFytikoEntityData = this._prepareFytikoEntityForRequest({...kalliergiaData, ...fytikoEntityBase });
        newEntitiesToAdd.push({
            entityName: "Edetedeaeefytiko", entityData: finalFytikoEntityData
        });

        if (syndedemeniData && syndedemeniData.eschId) {
            const nextRequestKodikos = 1;
            const requestFytikoBase = {
                id: `TEMP_ID_REQFYTIKO_${Date.now()}`,
                afm: currentEdehdData.afm, recordtype: 0, kodikos: nextRequestKodikos,
                eschLt2: 2, rowVersion: null, etos: this.EAE_YEAR,
                edeId: this.MAIN_APPLICATION_ID, // string ID
                edaId: agrotemaxioId,         // string ID
                edfId: tempFytikoId,          // string ID
                efyId: finalFytikoEntityData.efyId, // Παίρνουμε το προετοιμασμένο {id:...}
                poiId: finalFytikoEntityData.poiId, // Παίρνουμε το προετοιμασμένο {id:...}
                eschId: syndedemeniData.eschId,   // Περιμένουμε {id:'...'} ή string ID
                sexId: currentEdehdData.sexId || {id: "99gZmMPS9BTTkHuUFInwyw=="}, // Το sexId του χρήστη, περιμένουμε {id:'...'}
                usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null
            };
            const finalRequestFytikoData = this._prepareRequestFytikoEntityForRequest({...syndedemeniData, ...requestFytikoBase});
            newEntitiesToAdd.push({
                entityName: "Edetedeaeerequestfytiko", entityData: finalRequestFytikoData
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

    async addPAAToAgrotemaxio(agrotemaxioId, paaId) {
        this._log(`Attempting to add PAA ID: ${paaId} to agro ID: ${agrotemaxioId}`);
        // Έλεγχος αν υπάρχει ήδη για αποφυγή του edaaa_uk
        const existingPaas = await this.getPAAForAgrotemaxio(agrotemaxioId);
        if (existingPaas && existingPaas.some(p => p.eaaId && p.eaaId.id === paaId)) {
            this._warn(`PAA ID: ${paaId} already exists for agrotemaxio ID: ${agrotemaxioId}. Skipping addition.`);
            return { info: "PAA already exists." };
        }

        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) return null;

        const existingAgroPaas = await this.getPAAForAgrotemaxio(agrotemaxioId);
        const nextPaaKodikos = (existingAgroPaas && existingAgroPaas.length > 0)
            ? Math.max(0, ...existingAgroPaas.map(p => parseInt(p.kodikos, 10) || 0)) + 1
            : 1;

        const agroPaaEntity = {
            id: `TEMP_ID_AGROPAA_${Date.now()}`, afm: currentEdehdEntity.afm, recordtype: 0,
            kodikos: nextPaaKodikos, eaaLt2: 1, rowVersion: null, datasourcetype: 2, etos: this.EAE_YEAR,
            edeId: this.MAIN_APPLICATION_ID, // string ID
            edaId: agrotemaxioId,         // string ID
            eaaId: paaId,                 // Περιμένουμε string ID ή {id: string ID}
            sexId: null, // Συνήθως null
            usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null
        };
        return this._addRelatedEntities([{
            entityName: "Edetedeaeeagroipaa",
            entityData: this._prepareAgroPaaEntityForRequest(agroPaaEntity)
        }]);
    }

    async deletePAAFromAgrotemaxio(agroPaaId) {
        return this._deleteRelatedEntities([{ entityName: "Edetedeaeeagroipaa", entityId: agroPaaId }]);
    }

    async addEcoSchemesToAgrotemaxio(agrotemaxioId, ecoSchemeSubsidyIds = []) {
        // ... (παρόμοια λογική με τον έλεγχο για υπάρχοντα πριν την προσθήκη, αν χρειάζεται)
         if (!ecoSchemeSubsidyIds || ecoSchemeSubsidyIds.length === 0) { /* ... */ }
        const currentEdehdEntity = await this.fetchMainApplicationData();
        if (!currentEdehdEntity) return null;

        const existingEcoSchemes = await this.getEcoSchemesForAgrotemaxio(agrotemaxioId);
        let currentMaxEcoKodikos = 0;
        if (existingEcoSchemes && existingEcoSchemes.length > 0) {
            currentMaxEcoKodikos = Math.max(0, ...existingEcoSchemes.map(e => parseInt(e.kodikos,10) || 0));
        }

        const newEcoEntitiesData = [];
        for (const essuId of ecoSchemeSubsidyIds) {
            // Έλεγχος αν το συγκεκριμένο essuId υπάρχει ήδη για αυτό το αγροτεμάχιο
            if (existingEcoSchemes && existingEcoSchemes.some(e => e.essuId && e.essuId.id === essuId)) {
                this._warn(`Eco Scheme Subsidy ID: ${essuId} already exists for agrotemaxio ID: ${agrotemaxioId}. Skipping.`);
                continue;
            }
            currentMaxEcoKodikos++;
            const agroEcoEntity = {
                id: `TEMP_ID_AGROECO_${Date.now()}_${currentMaxEcoKodikos}`, afm: currentEdehdEntity.afm, recordtype: 0,
                kodikos: currentMaxEcoKodikos, rowVersion: null, datasourcetype: 2, etos: this.EAE_YEAR,
                edeId: this.MAIN_APPLICATION_ID, // string ID
                edaId: agrotemaxioId,         // string ID
                essuId: essuId,               // Περιμένουμε string ID ή {id: string ID}
                sexId: null,
                usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null
            };
            newEcoEntitiesData.push({
                entityName: "Edetedeaeeagroieco",
                entityData: this._prepareAgroEcoEntityForRequest(agroEcoEntity)
            });
        }

        if (newEcoEntitiesData.length > 0) {
            return this._addRelatedEntities(newEcoEntitiesData);
        } else {
            this._log("No new Eco Schemes to add (all might exist already or empty input).");
            return { info: "No new Eco Schemes to add." };
        }
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


    async _cloneKalliergiesAndSyndedemenes(sourceAgroId, targetAgroId, sourceKalliergies, sourceSyndedemenesMap, initialEdehd) {
        this._log(`Cloning Kalliergies & Syndedemenes from ${sourceAgroId} to ${targetAgroId}`);
        let currentEdehd = initialEdehd;
        const results = { success: true, messages: [], newEdehd: initialEdehd };

        // 1. Διαγραφή υπαρχουσών καλλιεργειών και συνδεδεμένων από το target
        const deleteOpsForKalliergies = [];
        const targetKalliergies = await this.getKalliergiesForAgrotemaxio(targetAgroId);
        if (targetKalliergies && targetKalliergies.length > 0) {
            this._log(`Found ${targetKalliergies.length} existing kalliergies in target ${targetAgroId} to delete.`);
            for (const fytiko of targetKalliergies) {
                const targetSyndedemenes = await this.getSyndedemenesForKalliergia(fytiko.id);
                if (targetSyndedemenes) {
                    targetSyndedemenes.forEach(s => deleteOpsForKalliergies.push({ status: 2, when: Date.now(), entityName: "Edetedeaeerequestfytiko", entity: { id: s.id, rowVersion: s.rowVersion } }));
                }
                deleteOpsForKalliergies.push({ status: 2, when: Date.now(), entityName: "Edetedeaeefytiko", entity: { id: fytiko.id, rowVersion: fytiko.rowVersion } });
            }

            if (deleteOpsForKalliergies.length > 0) {
                deleteOpsForKalliergies.push({
                    status: 1, when: 0, entityName: "Edetedeaeehd",
                    entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
                });
                try {
                    this._log(`Executing deletion of ${deleteOpsForKalliergies.length -1} kalliergia-related items from target ${targetAgroId}`);
                    await this._synchronizeChanges(deleteOpsForKalliergies);
                    results.messages.push("Old kalliergies/syndedemenes deleted successfully from target.");
                    currentEdehd = await this.fetchMainApplicationData(); // Ενημέρωση Edehd
                    if (!currentEdehd) throw new Error("Failed to re-fetch Edehd after kalliergia deletions.");
                    results.newEdehd = currentEdehd;
                } catch (error) {
                    this._error(`Failed to delete old kalliergies from target ${targetAgroId}:`, error);
                    results.success = false;
                    results.messages.push(`Error deleting old kalliergies: ${error.message || error}`);
                    return results; // Δεν συνεχίζουμε αν η διαγραφή αποτύχει
                }
            }
        }

        // 2. Προσθήκη νέων καλλιεργειών και συνδεδεμένων
        if (!sourceKalliergies || sourceKalliergies.length === 0) {
            this._log("No source kalliergies to clone.");
            return results;
        }

        const addOpsForKalliergies = [];
        let fytikoKodikosCounter = 0;
        for (const srcFytiko of sourceKalliergies) {
            fytikoKodikosCounter++;
            const tempNewFytikoId = `TEMP_CLONE_FYT_${targetAgroId}_${Date.now()}_${fytikoKodikosCounter}`;
            const preparedSrcFytiko = this._prepareFytikoEntityForRequest({ ...srcFytiko });

            const newFytikoEntityData = {
                afm: currentEdehd.afm, recordtype: 0, xptype: 1, kodikos: fytikoKodikosCounter,
                epilektash100: 0, // ΔΕΝ αντιγράφεται η έκταση
                dikaiomataflag: preparedSrcFytiko.dikaiomataflag !== undefined ? preparedSrcFytiko.dikaiomataflag : 1,
                synidiopercent: preparedSrcFytiko.synidiopercent !== undefined ? preparedSrcFytiko.synidiopercent : 100,
                iemtype: preparedSrcFytiko.iemtype !== undefined ? preparedSrcFytiko.iemtype : 1,
                efyId: preparedSrcFytiko.efyId, poiId: preparedSrcFytiko.poiId,
                emxpId: preparedSrcFytiko.emxpId, lkkoiId: preparedSrcFytiko.lkkoiId,
                sexId: preparedSrcFytiko.sexId !== undefined ? preparedSrcFytiko.sexId : (currentEdehd.ownerSexId?.id ? parseInt(currentEdehd.ownerSexId.id) : 40005),
                id: tempNewFytikoId, edaId: { id: targetAgroId }, edeId: { id: this.MAIN_APPLICATION_ID },
                rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                etos: this.EAE_YEAR, dtedke: new Date().toISOString() // Προσθήκη dtedke
            };
            addOpsForKalliergies.push({ status: 0, when: Date.now(), entityName: "Edetedeaeefytiko", entity: this._prepareFytikoEntityForRequest(newFytikoEntityData) });

            const srcSyndedemenes = sourceSyndedemenesMap[srcFytiko.id] || [];
            let syndedemeniKodikosCounter = 0;
            for (const srcSyndedemeni of srcSyndedemenes) {
                syndedemeniKodikosCounter++;
                const preparedSrcSyndedemeni = this._prepareRequestFytikoEntityForRequest({ ...srcSyndedemeni });
                const newSyndedemeniEntityData = {
                    afm: currentEdehd.afm, recordtype: 0, kodikos: syndedemeniKodikosCounter,
                    eschLt2: 2, eschId: preparedSrcSyndedemeni.eschId,
                    efyId: newFytikoEntityData.efyId, poiId: newFytikoEntityData.poiId,
                    sexId: currentEdehd.sexId, // sexId του χρήστη
                    id: `TEMP_CLONE_REQ_${targetAgroId}_${Date.now()}_${syndedemeniKodikosCounter}`,
                    edaId: { id: targetAgroId }, edeId: { id: this.MAIN_APPLICATION_ID },
                    edfId: { id: tempNewFytikoId }, rowVersion: null,
                    usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null, etos: this.EAE_YEAR
                };
                addOpsForKalliergies.push({ status: 0, when: Date.now(), entityName: "Edetedeaeerequestfytiko", entity: this._prepareRequestFytikoEntityForRequest(newSyndedemeniEntityData) });
            }
        }

        if (addOpsForKalliergies.length > 0) {
            addOpsForKalliergies.push({
                status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
            });
            try {
                this._log(`Executing addition of ${addOpsForKalliergies.length -1} new kalliergia-related items to target ${targetAgroId}`);
                const addResult = await this._synchronizeChanges(addOpsForKalliergies);
                results.messages.push(`New kalliergies/syndedemenes added to target. ${addResult.newEntitiesIds ? addResult.newEntitiesIds.length : 0} new DB IDs.`);
                currentEdehd = await this.fetchMainApplicationData();
                if (!currentEdehd) throw new Error("Failed to re-fetch Edehd after kalliergia additions.");
                results.newEdehd = currentEdehd;
            } catch (error) {
                this._error(`Failed to add new kalliergies to target ${targetAgroId}:`, error);
                results.success = false;
                results.messages.push(`Error adding new kalliergies: ${error.message || error}`);
            }
        }
        return results;
    }


    async _clonePAA(sourceAgroId, targetAgroId, sourcePaas, initialEdehd) {
        this._log(`Cloning PAA from ${sourceAgroId} to ${targetAgroId}`);
        let currentEdehd = initialEdehd;
        const results = { success: true, messages: [], newEdehd: initialEdehd };

        // 1. Διαγραφή υπαρχόντων ΠΑΑ από το target
        const deleteOpsForPaa = [];
        const targetPaas = await this.getPAAForAgrotemaxio(targetAgroId);
        if (targetPaas && targetPaas.length > 0) {
             this._log(`Found ${targetPaas.length} existing PAAs in target ${targetAgroId} to delete.`);
            targetPaas.forEach(p => deleteOpsForPaa.push({ status: 2, when: Date.now(), entityName: "Edetedeaeeagroipaa", entity: { id: p.id, rowVersion: p.rowVersion } }));
            deleteOpsForPaa.push({
                status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
            });
            try {
                await this._synchronizeChanges(deleteOpsForPaa);
                results.messages.push("Old PAAs deleted successfully from target.");
                currentEdehd = await this.fetchMainApplicationData();
                if (!currentEdehd) throw new Error("Failed to re-fetch Edehd after PAA deletions.");
                results.newEdehd = currentEdehd;
            } catch (error) { /* ... χειρισμός σφάλματος ... */ return results; }
        }

        // 2. Προσθήκη νέων ΠΑΑ
        if (!sourcePaas || sourcePaas.length === 0) { this._log("No source PAAs to clone."); return results; }

        const addOpsForPaa = [];
        let paaKodikosCounter = 0;
        for (const srcPaa of sourcePaas) {
            paaKodikosCounter++;
            const preparedSrcPaa = this._prepareAgroPaaEntityForRequest({ ...srcPaa });
            const newPaaEntityData = {
                afm: currentEdehd.afm, recordtype: 0, kodikos: paaKodikosCounter,
                eaaLt2: preparedSrcPaa.eaaLt2 !== undefined ? preparedSrcPaa.eaaLt2 : 1,
                datasourcetype: preparedSrcPaa.datasourcetype !== undefined ? preparedSrcPaa.datasourcetype : 2,
                eaaId: preparedSrcPaa.eaaId,
                id: `TEMP_CLONE_PAA_${targetAgroId}_${Date.now()}_${paaKodikosCounter}`,
                edaId: { id: targetAgroId }, edeId: { id: this.MAIN_APPLICATION_ID },
                rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                etos: this.EAE_YEAR, sexId: null
            };
            addOpsForPaa.push({ status: 0, when: Date.now(), entityName: "Edetedeaeeagroipaa", entity: this._prepareAgroPaaEntityForRequest(newPaaEntityData) });
        }

        if (addOpsForPaa.length > 0) {
            addOpsForPaa.push({
                status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
            });
            try {
                await this._synchronizeChanges(addOpsForPaa);
                results.messages.push("New PAAs added to target.");
                currentEdehd = await this.fetchMainApplicationData();
                if (!currentEdehd) throw new Error("Failed to re-fetch Edehd after PAA additions.");
                results.newEdehd = currentEdehd;
            } catch (error) { /* ... χειρισμός σφάλματος ... */ }
        }
        return results;
    }

    async _cloneEcoSchemes(sourceAgroId, targetAgroId, sourceEcoSchemes, initialEdehd) {
        this._log(`Cloning EcoSchemes from ${sourceAgroId} to ${targetAgroId}`);
        let currentEdehd = initialEdehd;
        const results = { success: true, messages: [], newEdehd: initialEdehd };

        // 1. Διαγραφή υπαρχόντων EcoSchemes από το target
        const deleteOpsForEco = [];
        const targetEcos = await this.getEcoSchemesForAgrotemaxio(targetAgroId);
        if (targetEcos && targetEcos.length > 0) {
            this._log(`Found ${targetEcos.length} existing EcoSchemes in target ${targetAgroId} to delete.`);
            targetEcos.forEach(e => deleteOpsForEco.push({ status: 2, when: Date.now(), entityName: "Edetedeaeeagroieco", entity: { id: e.id, rowVersion: e.rowVersion } }));
            deleteOpsForEco.push({
                status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
            });
            try {
                await this._synchronizeChanges(deleteOpsForEco);
                results.messages.push("Old EcoSchemes deleted successfully from target.");
                currentEdehd = await this.fetchMainApplicationData();
                if (!currentEdehd) throw new Error("Failed to re-fetch Edehd after EcoScheme deletions.");
                results.newEdehd = currentEdehd;
            } catch (error) { /* ... χειρισμός σφάλματος ... */ return results; }
        }

        // 2. Προσθήκη νέων EcoSchemes
        if (!sourceEcoSchemes || sourceEcoSchemes.length === 0) { this._log("No source EcoSchemes to clone."); return results; }

        const addOpsForEco = [];
        let ecoKodikosCounter = 0;
        for (const srcEco of sourceEcoSchemes) {
            ecoKodikosCounter++;
            const preparedSrcEco = this._prepareAgroEcoEntityForRequest({ ...srcEco });
            const newEcoEntityData = {
                afm: currentEdehd.afm, recordtype: 0, kodikos: ecoKodikosCounter,
                datasourcetype: preparedSrcEco.datasourcetype !== undefined ? preparedSrcEco.datasourcetype : 2,
                essuId: preparedSrcEco.essuId,
                id: `TEMP_CLONE_ECO_${targetAgroId}_${Date.now()}_${ecoKodikosCounter}`,
                edaId: { id: targetAgroId }, edeId: { id: this.MAIN_APPLICATION_ID },
                rowVersion: null, usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                etos: this.EAE_YEAR, sexId: null
            };
            addOpsForEco.push({ status: 0, when: Date.now(), entityName: "Edetedeaeeagroieco", entity: this._prepareAgroEcoEntityForRequest(newEcoEntityData) });
        }

        if (addOpsForEco.length > 0) {
            addOpsForEco.push({
                status: 1, when: 0, entityName: "Edetedeaeehd",
                entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
            });
            try {
                await this._synchronizeChanges(addOpsForEco);
                results.messages.push("New EcoSchemes added to target.");
                currentEdehd = await this.fetchMainApplicationData();
                if (!currentEdehd) throw new Error("Failed to re-fetch Edehd after EcoScheme additions.");
                results.newEdehd = currentEdehd;
            } catch (error) { /* ... χειρισμός σφάλματος ... */ }
        }
        return results;
    }


    // --- Κεντρική Συνάρτηση Αντιγραφής (Τροποποιημένη) ---
    async cloneAgrotemaxioData(sourceAgrotemaxioId, targetAgrotemaxioIds, dataToCloneConfig, strategy = 'overwrite') {
        if (strategy !== 'overwrite') {
            this._error("Clone strategy not implemented:", strategy);
            throw new Error(`Currently only 'overwrite' strategy is implemented for cloning.`);
        }
        this._log(`Cloning data from source ${sourceAgrotemaxioId} to targets ${targetAgrotemaxioIds.join(', ')} with config:`, dataToCloneConfig);

        let initialEdehd = await this.fetchMainApplicationData();
        if (!initialEdehd) {
            this._error("Cannot start clone: Failed to fetch initial main application data.");
            return { overallSuccess: false, message: "Failed to fetch initial main application data.", targets: {} };
        }

        // 1. Λήψη δεδομένων από την πηγή (μία φορά)
        const sourceData = {};
        this._log(`Fetching all source data from agrotemaxio ID: ${sourceAgrotemaxioId}`);
        if (dataToCloneConfig.kalliergies) {
            sourceData.kalliergies = await this.getKalliergiesForAgrotemaxio(sourceAgrotemaxioId);
            sourceData.syndedemenesMap = {}; // Χάρτης fytikoId -> array από syndedemenes
            if (sourceData.kalliergies) {
                for (const fytiko of sourceData.kalliergies) {
                    sourceData.syndedemenesMap[fytiko.id] = await this.getSyndedemenesForKalliergia(fytiko.id);
                }
            }
            this._log(`Source Kalliergies (${sourceData.kalliergies?.length || 0}) & Syndedemenes fetched.`);
        }
        if (dataToCloneConfig.paa) {
            sourceData.paa = await this.getPAAForAgrotemaxio(sourceAgrotemaxioId);
            this._log(`Source PAA (${sourceData.paa?.length || 0}) fetched.`);
        }
        if (dataToCloneConfig.ecoschemes) {
            sourceData.ecoschemes = await this.getEcoSchemesForAgrotemaxio(sourceAgrotemaxioId);
            this._log(`Source EcoSchemes (${sourceData.ecoschemes?.length || 0}) fetched.`);
        }

        const allTargetsResults = {};
        let overallSuccess = true;
        let lastSuccessfulEdehd = initialEdehd; // Το Edehd ενημερώνεται μετά από κάθε επιτυχή υπο-λειτουργία

        for (const targetId of targetAgrotemaxioIds) {
            if (targetId === sourceAgrotemaxioId) {
                this._warn(`Skipping clone to self: ${targetId}`);
                allTargetsResults[targetId] = { success: true, skipped: true, messages: ["Skipped self-cloning."] };
                continue;
            }
            this._log(`--- Processing Target Agrotemaxio: ${targetId} ---`);
            allTargetsResults[targetId] = { success: true, messages: [] };

            let currentEdehdForThisTargetOps = lastSuccessfulEdehd;

            if (dataToCloneConfig.kalliergies) {
                const kalliergiaResult = await this._cloneKalliergiesAndSyndedemenes(
                    sourceAgrotemaxioId, targetId,
                    sourceData.kalliergies, sourceData.syndedemenesMap,
                    currentEdehdForThisTargetOps
                );
                allTargetsResults[targetId].kalliergies = kalliergiaResult;
                if (!kalliergiaResult.success) {
                    allTargetsResults[targetId].success = false; overallSuccess = false;
                    this._error(`Failed cloning kalliergies for target ${targetId}. Moving to next target if any.`);
                    lastSuccessfulEdehd = kalliergiaResult.newEdehd; // Ακόμα κι αν απέτυχε, το edehd μπορεί να άλλαξε από τις διαγραφές
                    continue; // Προχώρα στο επόμενο target
                }
                lastSuccessfulEdehd = kalliergiaResult.newEdehd;
                currentEdehdForThisTargetOps = lastSuccessfulEdehd; // Ενημέρωση για την επόμενη υπο-λειτουργία σε αυτό το target
            }

            if (dataToCloneConfig.paa) {
                const paaResult = await this._clonePAA(
                    sourceAgrotemaxioId, targetId,
                    sourceData.paa,
                    currentEdehdForThisTargetOps
                );
                allTargetsResults[targetId].paa = paaResult;
                if (!paaResult.success) {
                    allTargetsResults[targetId].success = false; overallSuccess = false;
                    this._error(`Failed cloning PAA for target ${targetId}. Moving to next target if any.`);
                    lastSuccessfulEdehd = paaResult.newEdehd;
                    continue;
                }
                lastSuccessfulEdehd = paaResult.newEdehd;
                currentEdehdForThisTargetOps = lastSuccessfulEdehd;
            }

            if (dataToCloneConfig.ecoschemes) {
                const ecoResult = await this._cloneEcoSchemes(
                    sourceAgrotemaxioId, targetId,
                    sourceData.ecoschemes,
                    currentEdehdForThisTargetOps
                );
                allTargetsResults[targetId].ecoschemes = ecoResult;
                if (!ecoResult.success) {
                    allTargetsResults[targetId].success = false; overallSuccess = false;
                    this._error(`Failed cloning EcoSchemes for target ${targetId}. Moving to next target if any.`);
                    lastSuccessfulEdehd = ecoResult.newEdehd;
                    continue;
                }
                lastSuccessfulEdehd = ecoResult.newEdehd;
                // currentEdehdForThisTargetOps = lastSuccessfulEdehd; // Δεν υπάρχει επόμενη υπο-λειτουργία για αυτό το target
            }
            this._log(`--- Finished Processing Target Agrotemaxio: ${targetId} ---`);
        } // end for targetId

        this._log("Cloning process completed for all targets.");
        return { overallSuccess, targets: allTargetsResults };
    }
} // Τέλος Κλάσης

// --- Παράδειγμα Χρήσης (πιο απλό, ένα-ένα για αρχικό test) ---
// (async () => {
//     const MY_MAIN_APP_ID = prompt("Enter Main Application ID (edeId):", "qB8ujfgfAKWoOF+W1gH/Ow==");
//     const CURRENT_EAE_YEAR = parseInt(prompt("Enter EAE Year:", "2025"), 10);

//     if (!MY_MAIN_APP_ID || isNaN(CURRENT_EAE_YEAR)) {
//         alert("Main Application ID and a valid EAE Year are required."); return;
//     }
//     const agroHelper = new OpekepeAgroHelper(MY_MAIN_APP_ID, CURRENT_EAE_YEAR, { verbose: true });

//     try {
//         console.log("--- Initial Main App Data Fetch ---");
//         let mainAppData = await agroHelper.fetchMainApplicationData();
//         if (!mainAppData) { console.error("STOP: Main app data failed."); return; }
//         console.log("Initial Edehd rowVersion:", mainAppData.rowVersion);

//         const agrotemaxia = await agroHelper.fetchAllAgrotemaxia(3); // Πάρε 3 για δοκιμή
//         if (agrotemaxia.length < 1) { console.error("STOP: Need at least 1 agrotemaxio to test."); return; }
        
//         const testAgroId = agrotemaxia[0].id;
//         console.log(`Using Agrotemaxio ID: ${testAgroId} for individual tests.`);

//         // Test 1: Προσθήκη Καλλιέργειας (χωρίς συνδεδεμένη αρχικά)
//         console.log("\n--- Test: Add Kalliergia ---");
//         const kalliergiaAddResult = await agroHelper.addKalliergiaWithOptionalSyndedemeni(
//             testAgroId,
//             {
//                 epilektash100: 2.5,
//                 efyId: { id: "VMxnJnQisDYspssypbAjjA==" }, // ΣΚΛΗΡΟΣ ΣΙΤΟΣ
//                 poiId: { id: "Zu50wPtrta9nV1CJTP3nkQ==" }, // MARAKAS
//                 emxpId: { id: "MPYw1gb+m4i2+tcRPDJ17Q=="}, // Σχετικό emxpId
//                 // lkkoiId: 91940101 // Παράδειγμα αριθμητικού lkkoiId (kodikos)
//             }
//         );
//         console.log("Kalliergia Add Result:", kalliergiaAddResult);
//         if (kalliergiaAddResult && kalliergiaAddResult.newEntitiesIds) {
//             const newFytikoId = kalliergiaAddResult.newEntitiesIds.find(e => e.entityName === "Edetedeaeefytiko")?.databaseId;
//             if (newFytikoId) {
//                 console.log("New Fytiko ID:", newFytikoId);
//                 // Test 2: Προσθήκη Συνδεδεμένης σε αυτή την καλλιέργεια
//                 console.log("\n--- Test: Add Syndedemeni to New Kalliergia ---");
//                 const amesesList = await agroHelper.fetchAmesesEnisxyseisList();
//                 const syndedemeniSitos = amesesList.find(s => s.kodikos === "0102"); // ΣΚΛΗΡΟΣ ΣΙΤΟΣ
//                 if (syndedemeniSitos) {
//                     // Σημείωση: Η addKalliergiaWithOptionalSyndedemeni είναι για ταυτόχρονη προσθήκη.
//                     // Για να προσθέσουμε συνδεδεμένη σε *υπάρχον* fytiko, χρειαζόμαστε άλλη μέθοδο ή να επεκτείνουμε την υπάρχουσα.
//                     // Προς το παρόν, ας το προσομοιώσουμε καλώντας ξανά με όλα τα δεδομένα:
//                     // (Αυτό ΔΕΝ είναι ο ιδανικός τρόπος για update, αλλά για test προσθήκης)
//                      console.log("Simulating adding syndedemeni by re-adding fytiko with syndedemeni data (not ideal, for test only)");
//                      // Θα χρειαζόταν πρώτα διαγραφή του προηγούμενου fytiko αν θέλαμε να το κάνουμε "σωστά" έτσι.
//                      // Εναλλακτικά, μια νέα συνάρτηση addSyndedemeniToExistingFytiko(fytikoId, syndedemeniData)
//                 }
//             }
//         }

//         // Test 3: Προσθήκη ΠΑΑ
//         console.log("\n--- Test: Add PAA ---");
//         const paaList = await agroHelper.fetchPAAList();
//         const paa1014B = paaList.find(p => p.kodikos === "10.1.4Β");
//         if (paa1014B) {
//             const paaAddResult = await agroHelper.addPAAToAgrotemaxio(testAgroId, paa1014B.id);
//             console.log("PAA Add Result:", paaAddResult);
//         } else { console.warn("PAA 10.1.4B not found in catalog."); }

//         // Test 4: Προσθήκη Οικολογικού Σχήματος
//         console.log("\n--- Test: Add Eco Scheme ---");
//         const availableEcos = await agroHelper.fetchAvailableEcoSchemesForAgrotemaxio(testAgroId);
//         const eco616 = availableEcos.find(e => e.kodikos === "ECO-06.16");
//         if (eco616) {
//             const ecoAddResult = await agroHelper.addEcoSchemesToAgrotemaxio(testAgroId, [eco616.id]);
//             console.log("Eco Scheme Add Result:", ecoAddResult);
//         } else { console.warn("Eco Scheme ECO-06.16 not found for this agrotemaxio."); }

//         // Test 5: Διαγραφές (αν θέλεις να τις τεστάρεις, αφαίρεσε τα comments)
//         // console.log("\n--- Test: Deletions ---");
//         // const paasAfterAdd = await agroHelper.getPAAForAgrotemaxio(testAgroId);
//         // if (paasAfterAdd && paasAfterAdd.length > 0) {
//         //     console.log("Deleting PAA ID:", paasAfterAdd[0].id);
//         //     await agroHelper.deletePAAFromAgrotemaxio(paasAfterAdd[0].id);
//         // }
//         // const ecosAfterAdd = await agroHelper.getEcoSchemesForAgrotemaxio(testAgroId);
//         // if (ecosAfterAdd && ecosAfterAdd.length > 0) {
//         //     console.log("Deleting Eco Scheme ID:", ecosAfterAdd[0].id);
//         //     await agroHelper.deleteEcoSchemeFromAgrotemaxio(ecosAfterAdd[0].id);
//         // }
//         // const kalliergiesForDel = await agroHelper.getKalliergiesForAgrotemaxio(testAgroId);
//         // if (kalliergiesForDel && kalliergiesForDel.length > 0) {
//         //      console.log("Deleting Kalliergia ID:", kalliergiesForDel[0].id, "from agrotemaxio:", testAgroId);
//         //      await agroHelper.deleteKalliergiaFromAgrotemaxio(kalliergiesForDel[0].id, testAgroId);
//         // }


//         // Test 6: Clone (αν υπάρχουν τουλάχιστον 2 αγροτεμάχια)
//         // if (agrotemaxia.length >= 2) {
//         //     const sourceCloneId = agrotemaxia[0].id;
//         //     const targetCloneId = agrotemaxia[1].id;
//         //     console.log(`\n--- Test: Clone from ${sourceCloneId} to ${targetCloneId} ---`);
//         //     const cloneResult = await agroHelper.cloneAgrotemaxioData(
//         //         sourceCloneId,
//         //         [targetCloneId],
//         //         { kalliergies: true, paa: true, ecoschemes: true }
//         //     );
//         //     console.log("Clone Result:", JSON.stringify(cloneResult, null, 2));
//         // }


//     } catch (error) {
//         console.error("MAIN TEST EXECUTION ERROR:", error.data || error.message || error);
//     }
// })();
