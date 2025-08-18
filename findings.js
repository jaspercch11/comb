	(function () {
		let tableBody, modalRoot, newBtn, filterBtn;
		const API_BASE = 'http://localhost:3000';
		const filterState = { name: '', dept: '', order: 'asc' }; // order by due date

		function cryptoRandomId() {
			return 'r_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
		}

		function computeStatus(progress) {
			const p = Number(progress) || 0;
			if (p === 100) return 'Completed';
			if (p < 35) return 'At risk';
			if (p > 35 && p < 99) return 'On track';
			return 'On track';
		}

		async function apiGetRisks() {
			const res = await fetch(`${API_BASE}/api/risks`);
			if (!res.ok) throw new Error('Failed to load risks');
			return await res.json();
		}
		async function apiGetRisk(id) {
			const res = await fetch(`${API_BASE}/api/risks/${id}`);
			if (!res.ok) throw new Error('Failed to load risk');
			return await res.json();
		}
		async function apiCreateRisk(payload) {
			const res = await fetch(`${API_BASE}/api/risks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) throw new Error('Failed to create risk');
			return await res.json();
		}
		async function apiUpdateRiskTasks(id, tasks) {
			const res = await fetch(`${API_BASE}/api/risks/${id}/tasks`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tasks })
			});
			if (!res.ok) throw new Error('Failed to update tasks');
			return await res.json();
		}
		async function apiDeleteRisk(id) {
			const res = await fetch(`${API_BASE}/api/risks/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete risk');
			return await res.json();
		}

		function renderFillClass(status) {
			const s = String(status || '').toLowerCase();
			if (s === 'at risk') return 'fill-red';
			if (s === 'completed') return 'fill-green';
			return 'fill-lightgreen';
		}
		function statusBadgeClass(status) {
			const s = String(status || '').toLowerCase();
			if (s === 'at risk') return 'status-atrisk';
			if (s === 'completed') return 'status-completed';
			return 'status-ontrack';
		}

		function applyFilters(risks) {
			let list = Array.isArray(risks) ? risks.slice() : [];
			const name = filterState.name.trim().toLowerCase();
			const dept = filterState.dept.trim().toLowerCase();
			if (name) list = list.filter(r => String(r.risk_title || '').toLowerCase().includes(name));
			if (dept) list = list.filter(r => String(r.dept || '').toLowerCase().includes(dept));
			list.sort((a, b) => {
				const da = new Date(a.review_date).getTime();
				const db = new Date(b.review_date).getTime();
				return filterState.order === 'desc' ? db - da : da - db;
			});
			return list;
		}

		async function render() {
			try {
				console.log('🔄 Rendering risks table...');
				if (!tableBody) {
					console.error('❌ Table body not initialized');
					return;
				}
				
				const risks = applyFilters(await apiGetRisks());
				console.log(`📊 Rendering ${risks.length} risks`);
				
				tableBody.innerHTML = '';
				risks.forEach(risk => {
				const tr = document.createElement('tr');

				const nameTd = document.createElement('td');
				nameTd.className = 'risk-name';
				nameTd.textContent = risk.risk_title;

				const deptTd = document.createElement('td');
				const icon = document.createElement('span');
				icon.className = 'user-icon green';
				icon.title = 'Assigned User';
				deptTd.appendChild(icon);
				deptTd.appendChild(document.createTextNode(' ' + (risk.dept || 'Unassigned')));

				const dateTd = document.createElement('td');
				dateTd.className = 'due-date';
				const date = risk.review_date ? new Date(risk.review_date) : null;
				dateTd.textContent = date
					? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' })
					: '—';

				const status = computeStatus(risk.progress || 0);
				const progressTd = document.createElement('td');
				progressTd.innerHTML = `
					<div class="progress-bar">
					<div class="progress-bar-inner">
						<div class="progress-fill ${renderFillClass(status)}" style="width:${risk.progress || 0}%"></div>
					</div>
					<div class="percent">${risk.progress || 0}%</div>
					</div>
				`;

				const statusTd = document.createElement('td');
				statusTd.innerHTML = `<span class="status-badge ${statusBadgeClass(status)}">${status}</span>`;

				const actionTd = document.createElement('td');
				if ((risk.progress || 0) === 100) {
					const delBtn = document.createElement('button');
					delBtn.className = 'btn-edit';
					delBtn.textContent = 'Delete';
					delBtn.addEventListener('click', async () => {
					if (!confirm('Delete this completed risk?')) return;
					await apiDeleteRisk(risk.id);
					await render();
					});
					actionTd.appendChild(delBtn);
				} else {
					const editBtn = document.createElement('button');
					editBtn.className = 'btn-edit';
					editBtn.textContent = 'Edit';
					editBtn.addEventListener('click', () => openEditModal(risk.id));
					actionTd.appendChild(editBtn);
				}

				tr.appendChild(nameTd);
				tr.appendChild(deptTd);
				tr.appendChild(dateTd);
				tr.appendChild(progressTd);
				tr.appendChild(statusTd);
				tr.appendChild(actionTd);
				tableBody.appendChild(tr);
				});
				console.log('✅ Risks table rendered successfully');
			} catch (e) {
				console.error('❌ Error rendering risks table:', e);
				if (tableBody) {
					tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#b00;padding:8px;">Failed to load risks: ${e.message}</td></tr>`;
				}
			}
		}


		function openNewModal() {
			openModal('New Risk', buildRiskForm(), ({ close, getValues }) => {
				return [
					{ text: 'Cancel', variant: 'secondary', onClick: () => close() },
					{ text: 'Save', variant: 'primary', onClick: async () => {
						const values = getValues();
						console.log('Submitting:', values);
						const tasks = values.tasks.map(t => ({ label: t.label, weight: t.weight, done: false }));
						await apiCreateRisk({ risk_title: values.title, dept: values.dept, review_date: values.dueDate, tasks });
						await render();
						close();
					} }
				];
			});
		}

		async function openEditModal(riskId) {
			const risk = await apiGetRisk(riskId);
			openModal('Edit Risk Progress', buildTaskChecklist(risk), ({ close, getTaskValues }) => {
				return [
					{ text: 'Close', variant: 'secondary', onClick: () => close() },
					{ text: 'Save Changes', variant: 'primary', onClick: async () => {
						const updates = getTaskValues(); // [{id, done}]
						await apiUpdateRiskTasks(riskId, updates);
						await render();
						close();
					} }
				];
			});
		}

		function openModal(title, bodyEl, actionsBuilder) {
			const overlay = document.createElement('div');
			overlay.className = 'modal-overlay';
			const modal = document.createElement('div');
			modal.className = 'modal';

			const header = document.createElement('div');
			header.className = 'modal-header';
			const h3 = document.createElement('h3');
			h3.textContent = title;
			const closeBtn = document.createElement('button');
			closeBtn.className = 'modal-close';
			closeBtn.innerHTML = '&times;';
			closeBtn.addEventListener('click', close);
			header.appendChild(h3);
			header.appendChild(closeBtn);

			const body = document.createElement('div');
			body.className = 'modal-body';
			if (bodyEl) body.appendChild(bodyEl);

			const actions = document.createElement('div');
			actions.className = 'modal-actions';
			const makeActions = actionsBuilder({ close, getValues, getTaskValues });
			makeActions.forEach(a => {
				const b = document.createElement('button');
				b.className = `btn ${a.variant ? 'btn-' + a.variant : ''}`;
				b.textContent = a.text;
				b.addEventListener('click', a.onClick);
				actions.appendChild(b);
			});

			modal.appendChild(header);
			modal.appendChild(body);
			modal.appendChild(actions);
			overlay.appendChild(modal);
			modalRoot.appendChild(overlay);
			overlay.style.display = 'flex';

			function close() {
				modalRoot.removeChild(overlay);
			}
			function getValues() { return currentFormValues(); }
			function getTaskValues() { return currentTaskValues(); }

			let currentFormValues = () => ({});
			let currentTaskValues = () => [];

			if (bodyEl && bodyEl.__bindValues__) {
				const { setValuesGetter } = bodyEl.__bindValues__;
				setValuesGetter(fn => { currentFormValues = fn; });
			}
			if (bodyEl && bodyEl.__bindTaskGetter__) {
				const { setTaskGetter } = bodyEl.__bindTaskGetter__;
				setTaskGetter(fn => { currentTaskValues = fn; });
			}
		}

		function openFilterModal() {
			const container = document.createElement('div');
			const nameRow = formRow('Filter by Risk Name', 'text', filterState.name);
			const deptRow = formRow('Filter by Department', 'text', filterState.dept);
			const sortRow = document.createElement('div');
			sortRow.className = 'form-row';
			const sortLabel = document.createElement('label');
			sortLabel.textContent = 'Sort by Due Date';
			const sortContainer = document.createElement('div');
			sortContainer.style.display = 'flex';
			sortContainer.style.gap = '12px';
			const asc = document.createElement('label');
			const ascRadio = document.createElement('input'); ascRadio.type = 'radio'; ascRadio.name = 'sortOrder'; ascRadio.value = 'asc'; ascRadio.checked = filterState.order === 'asc';
			asc.appendChild(ascRadio); asc.appendChild(document.createTextNode(' Ascending'));
			const desc = document.createElement('label');
			const descRadio = document.createElement('input'); descRadio.type = 'radio'; descRadio.name = 'sortOrder'; descRadio.value = 'desc'; descRadio.checked = filterState.order === 'desc';
			desc.appendChild(descRadio); desc.appendChild(document.createTextNode(' Descending'));
			sortContainer.appendChild(asc); sortContainer.appendChild(desc);
			sortRow.appendChild(sortLabel);
			sortRow.appendChild(sortContainer);
			container.appendChild(nameRow.row);
			container.appendChild(deptRow.row);
			container.appendChild(sortRow);
	
			// live updates
			nameRow.input.addEventListener('input', async () => { filterState.name = nameRow.input.value; await render(); });
			deptRow.input.addEventListener('input', async () => { filterState.dept = deptRow.input.value; await render(); });
			ascRadio.addEventListener('change', async () => { if (ascRadio.checked) { filterState.order = 'asc'; await render(); } });
			descRadio.addEventListener('change', async () => { if (descRadio.checked) { filterState.order = 'desc'; await render(); } });
	
			openModal('Filters', container, ({ close }) => {
				return [
					{ text: 'Close', variant: 'secondary', onClick: () => close() }
				];
			});
		}

		function buildRiskForm() {
			const container = document.createElement('div');

			const titleRow = formRow('Risk Title', 'text', '');
			const deptRow = formRow('Assign To (Dept/Owner)', 'text', '');
			const dateRow = formRow('Due Date', 'date', new Date().toISOString().slice(0, 10));

			const tasksHeader = document.createElement('div');
			tasksHeader.style.fontWeight = '700';
			tasksHeader.style.margin = '10px 0 6px';
			tasksHeader.textContent = 'Tasks Checklist (weights sum to 100%)';

			const tasksList = document.createElement('div');
			tasksList.className = 'tasks-list';

			let customized = false;
			function seedTasksByTitle() {
				const titleVal = (titleRow.input.value || '').trim();
				const seeded = defaultTasks(titleVal || 'generic');
				tasksList.innerHTML = '';
				seeded.forEach(t => tasksList.appendChild(taskItemRow(t)));
			}
			seedTasksByTitle();
			titleRow.input.addEventListener('change', () => { if (!customized) seedTasksByTitle(); });
			tasksList.addEventListener('input', () => { customized = true; });
			tasksList.addEventListener('click', (e) => {
				const target = e.target;
				if (target && target.classList && target.classList.contains('btn-danger')) customized = true;
			});

			const addTaskBtn = document.createElement('button');
			addTaskBtn.className = 'btn btn-secondary';
			addTaskBtn.textContent = 'Add Task';
			addTaskBtn.addEventListener('click', () => {
				customized = true;
				const t = { id: cryptoRandomId(), label: 'New task', weight: 10, done: false };
				tasksList.appendChild(taskItemRow(t));
			});

			container.appendChild(titleRow.row);
			container.appendChild(deptRow.row);
			container.appendChild(dateRow.row);
			container.appendChild(tasksHeader);
			container.appendChild(tasksList);
			container.appendChild(addTaskBtn);

			container.__bindValues__ = {
				setValuesGetter: (fn) => {
					fn(() => ({
						title: titleRow.input.value.trim() || 'Untitled Risk',
						dept: deptRow.input.value.trim() || 'Unassigned',
						dueDate: dateRow.input.value,
						tasks: collectTasks(tasksList)
					}));
				}
			};

			return container;
		}

		function buildTaskChecklist(risk) {
			const container = document.createElement('div');
			const title = document.createElement('div');
			title.style.fontWeight = '700';
			title.style.marginBottom = '6px';
			title.textContent = risk.risk_title;
			container.appendChild(title);

			const tasksList = document.createElement('div');
			tasksList.className = 'tasks-list';
			(risk.tasks || []).forEach(t => {
				const el = taskCheckboxRow(t);
				tasksList.appendChild(el);
			});
			container.appendChild(tasksList);

			const progressPreview = document.createElement('div');
			progressPreview.style.marginTop = '8px';
			progressPreview.style.fontWeight = '700';
			progressPreview.textContent = `Progress: ${risk.progress || 0}%`;
			container.appendChild(progressPreview);

			container.__bindTaskGetter__ = {
				setTaskGetter: (fn) => {
					fn(() => collectTasksFromChecklist(tasksList, progressPreview));
				}
			};

			return container;
		}

		function formRow(labelText, type, value) {
			const row = document.createElement('div');
			row.className = 'form-row';
			const label = document.createElement('label');
			label.textContent = labelText;
			const input = document.createElement('input');
			input.type = type;
			input.value = value;
			row.appendChild(label);
			row.appendChild(input);
			return { row, input };
		}

		function taskItemRow(task) {
			const item = document.createElement('div');
			item.className = 'task-item';
			const left = document.createElement('input');
			left.type = 'text';
			left.value = task.label;
			left.style.flex = '1';
			const weight = document.createElement('input');
			weight.type = 'number';
			weight.value = String(task.weight);
			weight.min = '0';
			weight.max = '100';
			weight.style.width = '80px';
			const weightTag = document.createElement('span');
			weightTag.className = 'weight';
			weightTag.textContent = '%';
			const del = document.createElement('button');
			del.className = 'btn btn-danger';
			del.textContent = 'Remove';
			del.addEventListener('click', () => item.remove());
			item.appendChild(left);
			item.appendChild(weight);
			item.appendChild(weightTag);
			item.appendChild(del);
			return item;
		}

		function taskCheckboxRow(task) {
			const item = document.createElement('div');
			item.className = 'task-item';
			item.dataset.id = String(task.id);
			const left = document.createElement('label');
			left.style.display = 'flex';
			left.style.alignItems = 'center';
			left.style.gap = '10px';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = !!task.done;
			checkbox.addEventListener('change', () => {/* live preview handled on save */});
			const span = document.createElement('span');
			span.textContent = task.label;
			left.appendChild(checkbox);
			left.appendChild(span);
			const weight = document.createElement('span');
			weight.className = 'weight';
			weight.textContent = `+${task.weight}%`;
			item.appendChild(left);
			item.appendChild(weight);
			return item;
		}

		function collectTasks(tasksList) {
			const tasks = [];
			Array.from(tasksList.children).forEach(child => {
				if (!child.classList.contains('task-item')) return;
				const [labelInput, weightInput] = child.querySelectorAll('input');
				const label = (labelInput && labelInput.value ? labelInput.value.trim() : 'Task').slice(0, 200);
				const weight = clamp(parseInt(weightInput && weightInput.value || '0', 10) || 0, 0, 100);
				tasks.push({ id: cryptoRandomId(), label, weight, done: false });
			});
			const sum = tasks.reduce((s, t) => s + t.weight, 0);
			if (sum !== 100 && sum > 0) {
				tasks.forEach(t => { t.weight = Math.round((t.weight / sum) * 100); });
				let diff = 100 - tasks.reduce((s, t) => s + t.weight, 0);
				for (let i = 0; i < Math.abs(diff); i++) tasks[i % tasks.length].weight += Math.sign(diff);
			}
			return tasks;
		}

		function collectTasksFromChecklist(tasksList, previewEl) {
			const tasks = [];
			Array.from(tasksList.children).forEach(child => {
				if (!child.classList.contains('task-item')) return;
				const checkbox = child.querySelector('input[type="checkbox"]');
				const weightText = child.querySelector('.weight')?.textContent || '+0%';
				const weight = parseInt(weightText.replace(/[^0-9]/g, ''), 10) || 0;
				const id = child.dataset.id;
				const labelSpan = child.querySelector('label span');
				const label = labelSpan ? labelSpan.textContent : 'Task';
				tasks.push({ id: Number(id), label, weight, done: !!(checkbox && checkbox.checked) });
			});
			if (previewEl) {
				const progress = Math.round(tasks.reduce((sum, t) => sum + (t.done ? t.weight : 0), 0));
				previewEl.textContent = `Progress: ${progress}%`;
			}
			return tasks.map(({ id, done, label, weight }) => ({ id, done, label, weight }));
		}

		function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

		if (newBtn) newBtn.addEventListener('click', openNewModal);
		if (filterBtn) filterBtn.addEventListener('click', openFilterModal);

		render();
		// realtime refresh
		setInterval(render, 3000);

		// Task seeds
		function defaultTasks(riskName) {
			if (/gdpr violation/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Assess data exposure', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify DPO and legal', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Report to authorities', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Notify affected individuals', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Remediate breach', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Review policies & train staff', weight: 15, done: false }
				];
			}
			if (/data breach/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Isolate affected systems', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Investigate breach source', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify IT/security team', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Patch vulnerabilities', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Communicate with stakeholders', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Document and report', weight: 15, done: false }
				];
			}
			if (/product contamination/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Quarantine affected products', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify quality assurance', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Conduct root cause analysis', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Recall products if needed', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Remediate contamination', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Review and update SOPs', weight: 10, done: false }
				];
			}
			if (/labeling error|mislabeling/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Identify mislabeled products', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify regulatory team', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Correct labeling', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Recall if distributed', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Communicate with customers', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Review labeling process', weight: 10, done: false }
				];
			}
			if (/safety hazard - workplace/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Isolate hazard area', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify safety officer', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Investigate root cause', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Remediate hazard', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Conduct safety training', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Update safety protocols', weight: 10, done: false }
				];
			}
			if (/adverse customer reaction/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Document incident', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify customer service', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Investigate cause', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Provide remedy to customer', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Review product/process', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Report to management', weight: 10, done: false }
				];
			}
			if (/fraud|misconduct/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Suspend involved parties', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify compliance/legal', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Conduct investigation', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Document findings', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Implement corrective actions', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Review controls', weight: 10, done: false }
				];
			}
			if (/policy violation/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Document violation', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify HR/compliance', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Investigate incident', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Counsel involved parties', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Implement corrective actions', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Review and update policy', weight: 10, done: false }
				];
			}
			if (/system failure|downtime/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Notify IT support', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Diagnose failure', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Restore system', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Communicate outage', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Review incident', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Update recovery plan', weight: 10, done: false }
				];
			}
			if (/inventory loss|theft/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Secure area', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Notify security', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Investigate loss', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Document incident', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Report to authorities', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Review inventory controls', weight: 10, done: false }
				];
			}
			if (/supplier non-compliance/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Notify procurement', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Assess impact', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Engage supplier', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Document non-compliance', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Implement contingency', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Review supplier agreements', weight: 10, done: false }
				];
			}
			if (/budget|overrun/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Baseline current spend', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Negotiate vendor discounts', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Freeze nonessential purchases', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Weekly cost variance review', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Automate spend alerts', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Reforecast budget with stakeholders', weight: 20, done: false }
				];
			}
			if (/breach/i.test(riskName)) {
				return [
					{ id: cryptoRandomId(), label: 'Enable MFA for all privileged accounts', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Patch critical systems', weight: 20, done: false },
					{ id: cryptoRandomId(), label: 'Encrypt sensitive data at rest', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Implement IDS/IPS monitoring', weight: 15, done: false },
					{ id: cryptoRandomId(), label: 'Employee security awareness training', weight: 10, done: false },
					{ id: cryptoRandomId(), label: 'Backup and disaster recovery test', weight: 20, done: false }
				];
			}
			return [
				{ id: cryptoRandomId(), label: 'Define mitigation plan', weight: 20, done: false },
				{ id: cryptoRandomId(), label: 'Assign owner(s)', weight: 10, done: false },
				{ id: cryptoRandomId(), label: 'Identify key milestones', weight: 15, done: false },
				{ id: cryptoRandomId(), label: 'Execute main mitigation tasks', weight: 35, done: false },
				{ id: cryptoRandomId(), label: 'Validate outcomes', weight: 10, done: false },
				{ id: cryptoRandomId(), label: 'Close-out and document', weight: 10, done: false }
			];
		}

		// Heatmap functionality
		const categoryFilter = document.getElementById('categoryFilter');
		const addRiskBtn = document.getElementById('addRiskBtn');
		
		// Heatmap risks data - will be loaded from database
		let heatmapRisks = [];

		// Database API functions for heatmap risks
		async function fetchHeatmapRisks() {
			try {
				const response = await fetch(`${API_BASE}/api/heatmap-risks`);
				if (!response.ok) throw new Error('Failed to fetch heatmap risks');
				const risks = await response.json();
				heatmapRisks = risks;
				return risks;
			} catch (error) {
				console.error('Error fetching heatmap risks:', error);
				return [];
			}
		}

		async function createHeatmapRisk(riskData) {
			try {
				const response = await fetch(`${API_BASE}/api/heatmap-risks`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(riskData)
				});
				if (!response.ok) throw new Error('Failed to create heatmap risk');
				return await response.json();
			} catch (error) {
				console.error('Error creating heatmap risk:', error);
				throw error;
			}
		}

		async function updateHeatmapRisk(id, riskData) {
			try {
				const response = await fetch(`${API_BASE}/api/heatmap-risks/${id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(riskData)
				});
				if (!response.ok) throw new Error('Failed to update heatmap risk');
				return await response.json();
			} catch (error) {
				console.error('Error updating heatmap risk:', error);
				throw error;
			}
		}

		async function deleteHeatmapRisk(id) {
			try {
				const response = await fetch(`${API_BASE}/api/heatmap-risks/${id}`, {
					method: 'DELETE'
				});
				if (!response.ok) throw new Error('Failed to delete heatmap risk');
				return await response.json();
			} catch (error) {
				console.error('Error deleting heatmap risk:', error);
				throw error;
			}
		}

		// Function to render the heatmap
		function renderHeatmap(filter = 'all') {
			try {
				const heatmapGrid = document.getElementById('heatmapGrid');
				if (!heatmapGrid) {
					console.error('❌ Heatmap grid element not found');
					return;
				}

				console.log(`🎨 Rendering heatmap with filter: ${filter}`);
				console.log(`📊 Total heatmap risks: ${heatmapRisks.length}`);

				// Clear the grid
				heatmapGrid.innerHTML = '';

				// Filter risks if needed
				const filteredRisks = filter === 'all' 
					? heatmapRisks 
					: heatmapRisks.filter(risk => risk.category === filter);

				console.log(`🔍 Filtered risks: ${filteredRisks.length}`);

				// Generate the heatmap grid dynamically
				for (let impact = 5; impact >= 1; impact--) {
					// Create impact label row
					const impactLabel = document.createElement('div');
					impactLabel.className = 'impact-label';
					impactLabel.textContent = getImpactLabel(impact);
					heatmapGrid.appendChild(impactLabel);

					// Create cells for this impact level
					for (let likelihood = 1; likelihood <= 5; likelihood++) {
						const cell = document.createElement('div');
						cell.className = `heatmap-cell ${getRiskClass(impact, likelihood)}`;
						cell.setAttribute('data-impact', impact);
						cell.setAttribute('data-likelihood', likelihood);

						const riskContainer = document.createElement('div');
						riskContainer.className = 'risk-container';

						// Add risks that belong to this cell
						const cellRisks = filteredRisks.filter(risk => 
							risk.impact === impact && risk.likelihood === likelihood
						);

						if (cellRisks.length > 0) {
							console.log(`📍 Cell (${impact},${likelihood}): ${cellRisks.length} risks`);
						}

						cellRisks.forEach(risk => {
							const riskEl = document.createElement('div');
							riskEl.className = 'risk-item';
							riskEl.textContent = risk.name;
							riskEl.dataset.riskId = risk.id;
							riskEl.title = `${risk.name} - ${risk.dept} (Impact: ${risk.impact}, Likelihood: ${risk.likelihood})`;
							riskEl.addEventListener('click', () => showRiskDetails(risk.id));
							
							riskContainer.appendChild(riskEl);
						});

						cell.appendChild(riskContainer);
						heatmapGrid.appendChild(cell);
					}
				}

				console.log('✅ Heatmap rendered successfully');
			} catch (error) {
				console.error('❌ Error rendering heatmap:', error);
			}
		}

		// Helper function to get impact label
		function getImpactLabel(impact) {
			const labels = {
				5: 'Very High (5)',
				4: 'High (4)',
				3: 'Medium (3)',
				2: 'Low (2)',
				1: 'Very Low (1)'
			};
			return labels[impact] || '';
		}

		// Helper function to get risk class based on impact and likelihood
		function getRiskClass(impact, likelihood) {
			const score = impact * likelihood;
			if (score >= 20) return 'critical-risk';
			if (score >= 15) return 'very-high-risk';
			if (score >= 12) return 'high-risk';
			if (score >= 9) return 'moderate-risk';
			if (score >= 6) return 'medium-risk';
			if (score >= 3) return 'low-risk';
			return 'minimal-risk';
		}

		// Function to show risk details and allow editing
		function showRiskDetails(riskId) {
			const risk = heatmapRisks.find(r => r.id === riskId);
			if (!risk) return;

			// Create modal for editing risk
			const overlay = document.createElement('div');
			overlay.className = 'modal-overlay';
			overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0,0,0,0.5);
				display: flex;
				justify-content: center;
				align-items: center;
				z-index: 1000;
			`;

			const modal = document.createElement('div');
			modal.className = 'modal';
			modal.style.cssText = `
				background: white;
				border-radius: 8px;
				padding: 20px;
				max-width: 500px;
				width: 90%;
				max-height: 80vh;
				overflow-y: auto;
			`;

			modal.innerHTML = `
				<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
					<h3 style="margin: 0;">Edit Risk</h3>
					<button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
				</div>
				<div class="modal-body">
					<form id="editRiskForm">
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Risk Name:</label>
							<input type="text" id="editRiskName" value="${risk.name}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Department:</label>
							<input type="text" id="editRiskDept" value="${risk.dept}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Category:</label>
							<select id="editRiskCategory" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="Financial" ${risk.category === 'Financial' ? 'selected' : ''}>Financial</option>
								<option value="Operational" ${risk.category === 'Operational' ? 'selected' : ''}>Operational</option>
								<option value="Strategic" ${risk.category === 'Strategic' ? 'selected' : ''}>Strategic</option>
								<option value="Compliance" ${risk.category === 'Compliance' ? 'selected' : ''}>Compliance</option>
								<option value="Reputational" ${risk.category === 'Reputational' ? 'selected' : ''}>Reputational</option>
							</select>
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Impact Level:</label>
							<select id="editRiskImpact" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="1" ${risk.impact === 1 ? 'selected' : ''}>Very Low (1)</option>
								<option value="2" ${risk.impact === 2 ? 'selected' : ''}>Low (2)</option>
								<option value="3" ${risk.impact === 3 ? 'selected' : ''}>Medium (3)</option>
								<option value="4" ${risk.impact === 4 ? 'selected' : ''}>High (4)</option>
								<option value="5" ${risk.impact === 5 ? 'selected' : ''}>Very High (5)</option>
							</select>
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Likelihood Level:</label>
							<select id="editRiskLikelihood" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="1" ${risk.likelihood === 1 ? 'selected' : ''}>Very Low (1)</option>
								<option value="2" ${risk.likelihood === 2 ? 'selected' : ''}>Low (2)</option>
								<option value="3" ${risk.likelihood === 3 ? 'selected' : ''}>Medium (3)</option>
								<option value="4" ${risk.likelihood === 4 ? 'selected' : ''}>High (4)</option>
								<option value="5" ${risk.likelihood === 5 ? 'selected' : ''}>Very High (5)</option>
							</select>
						</div>
					</form>
				</div>
				<div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
					<button class="btn" onclick="closeEditModal()" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; cursor: pointer;">Cancel</button>
					<button class="btn btn-primary" onclick="updateRisk(${risk.id})" style="padding: 8px 16px; border: none; border-radius: 4px; background: #1E5ADC; color: white; cursor: pointer;">Update Risk</button>
					<button class="btn" onclick="deleteRisk(${risk.id})" style="padding: 8px 16px; border: 1px solid #dc3545; border-radius: 4px; background: #fff; color: #dc3545; cursor: pointer;">Delete Risk</button>
				</div>
			`;

			overlay.appendChild(modal);
			document.body.appendChild(overlay);

			// Close modal functionality
			const closeModal = () => {
				try { document.body.removeChild(overlay); } catch(e){}
			};

			modal.querySelector('.modal-close').onclick = closeModal;
			overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });
			document.addEventListener('keydown', function onKey(e) { if(e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); } });

			// Make functions globally accessible
			window.closeEditModal = closeModal;
			window.updateRisk = updateRisk;
			window.deleteRisk = deleteRisk;
		}

		// Function to add new risk
		function openAddRiskModal() {
			const overlay = document.createElement('div');
			overlay.className = 'modal-overlay';
			overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0,0,0,0.5);
				display: flex;
				justify-content: center;
				align-items: center;
				z-index: 1000;
			`;

			const modal = document.createElement('div');
			modal.className = 'modal';
			modal.style.cssText = `
				background: white;
				border-radius: 8px;
				padding: 20px;
				max-width: 500px;
				width: 90%;
				max-height: 80vh;
				overflow-y: auto;
			`;

			modal.innerHTML = `
				<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
					<h3 style="margin: 0;">Add New Risk</h3>
					<button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
				</div>
				<div class="modal-body">
					<form id="addRiskForm">
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Risk Name:</label>
							<input type="text" id="addRiskName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Department:</label>
							<input type="text" id="addRiskDept" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Category:</label>
							<select id="addRiskCategory" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="Financial">Financial</option>
								<option value="Operational">Operational</option>
								<option value="Strategic">Strategic</option>
								<option value="Compliance">Compliance</option>
								<option value="Reputational">Reputational</option>
							</select>
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Impact Level:</label>
							<select id="addRiskImpact" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="1">Very Low (1)</option>
								<option value="2">Low (2)</option>
								<option value="3">Medium (3)</option>
								<option value="4">High (4)</option>
								<option value="5">Very High (5)</option>
							</select>
						</div>
						<div style="margin-bottom: 15px;">
							<label style="display: block; font-weight: 600; margin-bottom: 5px;">Likelihood Level:</label>
							<select id="addRiskLikelihood" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="1">Very Low (1)</option>
								<option value="2">Low (2)</option>
								<option value="3">Medium (3)</option>
								<option value="4">High (4)</option>
								<option value="5">Very High (5)</option>
							</select>
						</div>
					</form>
				</div>
				<div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
					<button class="btn" onclick="closeAddModal()" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; cursor: pointer;">Cancel</button>
					<button class="btn btn-primary" onclick="submitAddRisk()" style="padding: 8px 16px; border: none; border-radius: 4px; background: #1E5ADC; color: white; cursor: pointer;">Add Risk</button>
				</div>
			`;

			overlay.appendChild(modal);
			document.body.appendChild(overlay);

			// Close modal functionality
			const closeModal = () => {
				try { document.body.removeChild(overlay); } catch(e){}
			};

			modal.querySelector('.modal-close').onclick = closeModal;
			overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });
			document.addEventListener('keydown', function onKey(e) { if(e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); } });

			// Make functions globally accessible
			window.closeAddModal = closeModal;
			window.submitAddRisk = submitAddRisk;
		}

		// Function to submit new risk
		async function submitAddRisk() {
			const name = document.getElementById('addRiskName').value;
			const dept = document.getElementById('addRiskDept').value;
			const category = document.getElementById('addRiskCategory').value;
			const impact = parseInt(document.getElementById('addRiskImpact').value);
			const likelihood = parseInt(document.getElementById('addRiskLikelihood').value);

			if (!name || !dept) {
				alert('Please fill in all required fields');
				return;
			}

			try {
				const newRisk = await createHeatmapRisk({
					name: name,
					dept: dept,
					category: category,
					impact: impact,
					likelihood: likelihood
				});

				// Refresh the risks list and re-render
				await fetchHeatmapRisks();
				renderHeatmap(categoryFilter.value);
				closeAddModal();
			} catch (error) {
				alert('Error adding risk: ' + error.message);
			}
		}

		// Function to update existing risk
		async function updateRisk(riskId) {
			const risk = heatmapRisks.find(r => r.id === riskId);
			if (!risk) return;

			const name = document.getElementById('editRiskName').value;
			const dept = document.getElementById('editRiskDept').value;
			const category = document.getElementById('editRiskCategory').value;
			const impact = parseInt(document.getElementById('editRiskImpact').value);
			const likelihood = parseInt(document.getElementById('editRiskLikelihood').value);

			if (!name || !dept) {
				alert('Please fill in all required fields');
				return;
			}

			try {
				await updateHeatmapRisk(riskId, {
					name: name,
					dept: dept,
					category: category,
					impact: impact,
					likelihood: likelihood
				});

				// Refresh the risks list and re-render
				await fetchHeatmapRisks();
				renderHeatmap(categoryFilter.value);
				closeEditModal();
			} catch (error) {
				alert('Error updating risk: ' + error.message);
			}
		}

		// Function to delete risk
		async function deleteRisk(riskId) {
			if (confirm('Are you sure you want to delete this risk?')) {
				try {
					await deleteHeatmapRisk(riskId);
					
					// Refresh the risks list and re-render
					await fetchHeatmapRisks();
					renderHeatmap(categoryFilter.value);
					closeEditModal();
				} catch (error) {
					alert('Error deleting risk: ' + error.message);
				}
			}
		}

		// Function to fetch and display all risks in the table
		async function loadRisks() {
			try {
				console.log('📋 Loading risks table...');
				const res = await fetch('http://localhost:3000/api/risks');
				if (!res.ok) {
					throw new Error(`Failed to fetch risks: ${res.status}`);
				}
				const risks = await res.json();
				console.log(`✅ Fetched ${risks.length} risks`);
				
				const tableBody = document.getElementById('risksTableBody');
				if (!tableBody) {
					console.error('❌ Risks table body not found');
					return;
				}
				
				tableBody.innerHTML = '';
				
				if (risks.length === 0) {
					tableBody.innerHTML = `
						<tr>
							<td colspan="6" style="text-align: center; padding: 20px; color: #666;">
								No risks found
							</td>
						</tr>
					`;
					return;
				}
				
				risks.forEach(risk => {
					const row = document.createElement('tr');
					row.innerHTML = `
						<td>${risk.risk_title}</td>
						<td>${risk.dept || 'Unassigned'}</td>
						<td>${risk.review_date ? new Date(risk.review_date).toLocaleDateString() : 'Not Scheduled'}</td>
						<td>${risk.progress || 0}%</td>
						<td><span class="status-badge status-${risk.status || 'on track'}">${risk.status || 'on track'}</span></td>
						<td>
							<button class="btn btn-view" onclick="viewRisk(${risk.id})">View</button>
							<button class="btn btn-edit" onclick="editRisk(${risk.id})">Edit</button>
						</td>
					`;
					tableBody.appendChild(row);
				});
				
				console.log('✅ Risks table loaded successfully');
			} catch (error) {
				console.error('❌ Error loading risks:', error);
				const tableBody = document.getElementById('risksTableBody');
				if (tableBody) {
					tableBody.innerHTML = `
						<tr>
							<td colspan="6" style="text-align: center; padding: 20px; color: #ff0000;">
								Error loading risks: ${error.message}
							</td>
						</tr>
					`;
				}
			}
		}

		// Handle form submission (only if form exists on page)
		const findingsForm = document.getElementById('findings-form');
		if (findingsForm) {
			findingsForm.addEventListener('submit', async function(e) {
				e.preventDefault();
				// Gather form data
				const risk_title = document.getElementById('risk_title').value;
				const dept = document.getElementById('dept').value;
				const review_date = document.getElementById('review_date').value;
				// Gather tasks as an array (adjust as per your form structure)
				const tasks = [
					// Example: { label: 'Task 1', weight: 1, done: false }
					// Populate this array from your form inputs
				];

				const res = await fetch('http://localhost:3000/api/risks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ risk_title, dept, review_date, tasks })
				});

				if (res.ok) {
					// After saving, reload the risks table
					await loadRisks();
					// Optionally, reset the form
					this.reset();
				} else {
					alert('Failed to save finding!');
				}
			});

			// On page load, display all risks for this form page
			window.onload = loadRisks;
		}

		// Initialize heatmap functionality
		if (categoryFilter) {
			categoryFilter.addEventListener('change', (e) => {
				renderHeatmap(e.target.value);
			});
		}

		// Initialize Add Risk button
		if (addRiskBtn) {
			addRiskBtn.addEventListener('click', openAddRiskModal);
		}

		// Initialize DOM elements
		function initializeDOMElements() {
			tableBody = document.getElementById('risksTableBody');
			modalRoot = document.getElementById('modalRoot');
			newBtn = document.querySelector('.new-btn');
			filterBtn = document.querySelector('.filter-btn');
			
			if (!tableBody) {
				console.error('❌ Risks table body not found');
			}
			if (!modalRoot) {
				console.error('❌ Modal root not found');
			}
			if (!newBtn) {
				console.error('❌ New button not found');
			}
			if (!filterBtn) {
				console.error('❌ Filter button not found');
			}

			// Wire up actions now that elements are available
			if (newBtn) {
				newBtn.addEventListener('click', openNewModal);
			}
			if (filterBtn) {
				filterBtn.addEventListener('click', openFilterModal);
			}
		}

		// Initialize heatmap on page load
		document.addEventListener('DOMContentLoaded', async () => {
			try {
				console.log('🚀 Initializing findings page...');
				
				// Initialize DOM elements first
				initializeDOMElements();
				
				// Load risks from database first
				console.log('📊 Loading heatmap risks...');
				await fetchHeatmapRisks();
				console.log(`✅ Loaded ${heatmapRisks.length} heatmap risks`);
				
				console.log('🎨 Rendering heatmap...');
				renderHeatmap();
				
				// Load risks table
				console.log('📋 Loading risks table...');
				await render();
				
				// Initialize logout functionality
				initializeLogout();
				
				console.log('🎉 Findings page initialized successfully!');
			} catch (error) {
				console.error('❌ Error initializing findings page:', error);
			}
		});

		// Logout functionality
		function initializeLogout() {
			const userSection = document.getElementById('userSection');
			const logoutDropdown = document.getElementById('logoutDropdown');
			
			if (userSection && logoutDropdown) {
				// Show logout dropdown on user section click
				userSection.addEventListener('click', (e) => {
					e.stopPropagation();
					logoutDropdown.classList.toggle('show');
				});
				
				// Hide logout dropdown when clicking outside
				document.addEventListener('click', (e) => {
					if (!userSection.contains(e.target)) {
						logoutDropdown.classList.remove('show');
					}
				});
			}
		}

		// Logout function
		function logout() {
			// You can add any cleanup logic here (clear session, etc.)
			window.location.href = 'index.html';
		}

		// Placeholder functions for risk actions
		window.viewRisk = function(riskId) {
			alert(`View risk ${riskId} - Functionality coming soon!`);
		};

		window.editRisk = function(riskId) {
			alert(`Edit risk ${riskId} - Functionality coming soon!`);
		};



	})();