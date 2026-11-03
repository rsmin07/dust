// 내부 Vercel 서버리스 API 엔드포인트 주소
const API_URL = '/api/dust';

// 시도 선택 드롭다운 DOM 엘리먼트 가져오기
const sidoSelect = document.getElementById('sidoSelect');

// 평균 미세먼지 수치 표시 DOM 엘리먼트 가져오기
const averageValueEl = document.getElementById('averageValue');

// 평균 상태 설명 문구 DOM 엘리먼트 가져오기
const averageStatusEl = document.getElementById('averageStatus');

// 측정소 카드들이 배치될 그리드 컨테이너 DOM 엘리먼트 가져오기
const stationGrid = document.getElementById('stationGrid');

// 등급 번호에 대응하는 한글 등급명 매핑 객체
const GRADE_NAMES = {
    '1': '좋음',
    '2': '보통',
    '3': '나쁨',
    '4': '매우나쁨'
};

// 미세먼지 등급 번호에 따른 CSS 클래스 반환 함수
function getGradeClass(grade) {
    // 1~4 등급이면 해당 클래스명 반환
    if (['1', '2', '3', '4'].includes(grade)) {
        return `grade-${grade}`;
    }
    // 값이 비어있거나 유효하지 않으면 기본 회색 클래스 반환
    return 'grade-unknown';
}

// 측정값 문자열을 유효한 수치 포맷 또는 '측정 안 됨'으로 변환하는 함수
function formatValue(val) {
    // 값이 없거나 '-' 또는 빈 문자열인 경우 '측정 안 됨' 반환
    if (!val || val.trim() === '-' || val.trim() === '') {
        return '측정 안 됨';
    }
    // 정상 수치인 경우 단위(㎍/㎥)와 함께 반환
    return `${val} ㎍/㎥`;
}

// 선택된 시도의 대기오염 데이터를 Vercel 서버리스 API(/api/dust)로부터 호출하는 함수
async function fetchAirQualityData(sidoName) {
    // 로딩 중임을 사용자에게 안내
    stationGrid.innerHTML = '<div class="message-box">데이터를 불러오는 중입니다...</div>';
    averageValueEl.innerHTML = `- <span>㎍/㎥</span>`;
    averageStatusEl.textContent = '데이터 계산 중...';

    // 브라우저에서 index.html 파일을 직접 더블클릭(file://)하여 연 경우 안내
    if (window.location.protocol === 'file:') {
        stationGrid.innerHTML = `
            <div class="message-box">
                <p style="font-weight: bold; margin-bottom: 8px;">⚠️ 파일을 직접 열었습니다 (file://)</p>
                <p>서버리스 API(/api/dust)를 사용하기 위해 웹 서버를 통해 접속해야 합니다.</p>
                <p style="margin-top: 8px; color: #1a73e8; font-weight: bold;">브라우저 주소창에 <u>http://localhost:3000</u> 으로 접속해주세요!</p>
            </div>
        `;
        averageValueEl.innerHTML = `안내`;
        averageStatusEl.textContent = 'http://localhost:3000 접속 필요';
        return;
    }

    try {
        // 내부 서버리스 API 엔드포인트로 시도 파라미터를 넘겨 호출
        const response = await fetch(`${API_URL}?sido=${encodeURIComponent(sidoName)}`);

        // JSON 응답 파싱
        const data = await response.json();

        // 서버에서 에러 객체를 반환했거나 응답 코드가 비정상인 경우
        if (!response.ok || data.error) {
            throw new Error(data.error || `네트워크 오류 (상태코드: ${response.status})`);
        }

        // API 결과 데이터에서 측정소 항목 배열 추출
        const items = data.response?.body?.items || [];

        // 측정소 데이터가 비어있는 경우 안내 처리
        if (items.length === 0) {
            stationGrid.innerHTML = '<div class="message-box">해당 지역의 측정소 데이터가 없습니다.</div>';
            averageValueEl.innerHTML = `- <span>㎍/㎥</span>`;
            averageStatusEl.textContent = '조회 결과 없음';
            return;
        }

        // 가져온 측정소 데이터로 화면 렌더링 함수 실행
        renderStations(items, sidoName);
    } catch (error) {
        // 서버리스 함수 에러 또는 네트워크 오류 처리
        console.error('API 호출 중 오류 발생:', error);
        stationGrid.innerHTML = `<div class="message-box">${error.message || '데이터를 불러오지 못했습니다.'}</div>`;
        averageValueEl.innerHTML = `오류`;
        averageStatusEl.textContent = '조회 실패';
    }
}

// 측정소 카드 목록과 상단 평균 수치를 계산하고 화면에 렌더링하는 함수
function renderStations(items, sidoName) {
    // 측정소 카드 그리드 초기화
    stationGrid.innerHTML = '';

    // 평균 계산용 미세먼지 합계 변수 초기화
    let pm10Sum = 0;
    // 유효한 미세먼지 측정소 개수 카운트 변수 초기화
    let validPm10Count = 0;

    // 각 측정소별 카드를 동적으로 생성하여 그리드에 추가
    items.forEach((item) => {
        // 측정소 이름
        const stationName = item.stationName || '알 수 없음';
        // 미세먼지 수치 (pm10Value)
        const pm10Raw = item.pm10Value;
        // 초미세먼지 수치 (pm25Value)
        const pm25Raw = item.pm25Value;
        // 미세먼지 등급 (pm10Grade: 1~4)
        const grade = item.pm10Grade ? item.pm10Grade.trim() : '';
        // 측정 시각 (dataTime)
        const dataTime = item.dataTime || '-';

        // 미세먼지 수치가 정상적인 숫자인 경우 평균 계산에 합산
        if (pm10Raw && pm10Raw.trim() !== '-' && !isNaN(Number(pm10Raw))) {
            pm10Sum += Number(pm10Raw);
            validPm10Count++;
        }

        // 등급 번호에 맞는 CSS 색상 클래스 가져오기
        const gradeClass = getGradeClass(grade);
        // 등급 한글 텍스트 설정 (없으면 '정보 없음')
        const gradeText = GRADE_NAMES[grade] || '정보 없음';

        // 카드 엘리먼트 생성
        const card = document.createElement('div');
        // 카드 엘리먼트에 기본 클래스 및 등급별 배경색 클래스 부여
        card.className = `station-card ${gradeClass}`;

        // 카드 내부 HTML 구조 작성
        card.innerHTML = `
            <div class="card-top">
                <span class="station-name">${stationName}</span>
                <span class="grade-text">${gradeText}</span>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span>미세먼지(PM10)</span>
                    <strong>${formatValue(pm10Raw)}</strong>
                </div>
                <div class="info-row">
                    <span>초미세먼지(PM2.5)</span>
                    <strong>${formatValue(pm25Raw)}</strong>
                </div>
            </div>
            <div class="card-bottom">
                측정 시각: ${dataTime}
            </div>
        `;

        // 생성한 카드를 그리드에 추가
        stationGrid.appendChild(card);
    });

    // 유효한 측정 수치가 하나 이상 있는 경우 평균값 계산
    if (validPm10Count > 0) {
        // 소수점 첫째 자리까지 평균 계산
        const average = (pm10Sum / validPm10Count).toFixed(1);
        // 상단 평균 수치 영역에 반영
        averageValueEl.innerHTML = `${average} <span>㎍/㎥</span>`;
        // 평균 상태 설명 문구 업데이트
        averageStatusEl.textContent = `${sidoName} 지역 총 ${validPm10Count}개 유효 측정소 기준`;
    } else {
        // 유효 측정값이 없는 경우 처리
        averageValueEl.innerHTML = `측정 안 됨`;
        averageStatusEl.textContent = `${sidoName} 지역의 유효한 미세먼지 측정값이 없습니다.`;
    }
}

// 시도 선택 드롭다운 변경 시 이벤트 리스너 등록
sidoSelect.addEventListener('change', (e) => {
    // 변경된 시도명으로 API 재호출
    fetchAirQualityData(e.target.value);
});

// 페이지 최초 로드 시 기본 선택된 지역(서울)으로 데이터 조회 실행
document.addEventListener('DOMContentLoaded', () => {
    fetchAirQualityData(sidoSelect.value);
});
