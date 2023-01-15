scServices.evalScore = {
	fEvals : {},
	setEvalScore : function(pId, pMinPts, pSorePts, pMaxPts){
		var vMinPts = 0, vScorePts = 0, vMaxPts = 0, vScore = 0;
		if (!this.fEvals[pId]) this.fEvals[pId] = {minPts:0,scorePts:0,maxPts:0};
		this.fEvals[pId] = {minPts:pMinPts,scorePts:pSorePts,maxPts:pMaxPts};
		for (var vId in this.fEvals){
			var vEval = this.fEvals[vId];
			vMinPts += vEval.minPts;
			vScorePts += vEval.scorePts;
			vMaxPts += vEval.maxPts;
		}
		vScore = Math.round( (vScorePts - vMinPts) / (vMaxPts - vMinPts) * 100);
		if(scServices.scorm2k4 && scServices.scorm2k4.isScorm2k4Active()) {
			var vApi = scServices.scorm2k4.getScorm2k4API();
			vApi.SetValue("cmi.score.scaled", vScore/100 );
			vApi.SetValue("cmi.score.raw", vScorePts );
			vApi.SetValue("cmi.score.min", vMinPts );
			vApi.SetValue("cmi.score.max", vMaxPts );
			var vPassingScore = vApi.GetValue("cmi.scaled_passing_score") || 1;
			vApi.SetValue("cmi.success_status", vScore/100>=vPassingScore ? "passed" : "failed");
			if(scServices.completionStorage) scServices.completionStorage.commit(false);
			scServices.assmntMgr.commit(false);
			vApi.Commit("");
		} else if(scServices.scorm12 && scServices.scorm12.isScorm12Active()) {
			var vApi = scServices.scorm12.getScorm12API();
			vApi.LMSSetValue("cmi.core.score.raw", vScore);
			vApi.LMSSetValue("cmi.core.score.min", 0 );
			vApi.LMSSetValue("cmi.core.score.max", 100 );
			if(scServices.completionStorage) scServices.completionStorage.commit(false)
			scServices.assmntMgr.commit(false);
			vApi.LMSCommit("");
		}
	}
}
