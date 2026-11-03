// Vercel 서버리스 함수: 에어코리아 대기오염 API 중계 핸들러
export default async function handler(req, res) {
    // 쿼리스트링에서 시도(sido) 값을 추출하며, 없을 경우 기본값으로 '서울' 지정
    const { sido = '서울' } = req.query;

    // Vercel 환경변수에서 Decoding 인증키 로드
    const serviceKey = process.env.AIRKOREA_KEY;

    // 환경변수에 인증키가 설정되어 있지 않은 경우 500 에러 반환
    if (!serviceKey) {
        return res.status(500).json({
            error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.'
        });
    }

    // Decoding 키를 URL 파라미터 규격에 맞게 encodeURIComponent 처리
    const encodedKey = encodeURIComponent(serviceKey);
    // 시도 이름 한글 인코딩 처리
    const encodedSido = encodeURIComponent(sido);

    // 에어코리아 실시간 대기오염 정보 조회 API 최종 호출 URL 생성
    const targetUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodedSido}&ver=1.3`;

    try {
        // 공공데이터포털 API로 GET 요청 전송
        const response = await fetch(targetUrl);

        // XML 에러 또는 JSON 파싱 실패 여부를 안전하게 감지하기 위해 우선 텍스트 형태로 수신
        const responseText = await response.text();

        // 수신된 텍스트를 JSON으로 파싱 시도
        let jsonData;
        try {
            jsonData = JSON.parse(responseText);
        } catch (parseError) {
            // JSON이 아닌 XML 에러 태그 등으로 응답이 온 경우 사용자 친화적 에러 메시지 반환
            return res.status(400).json({
                error: '인증키 또는 요청값을 확인해주세요.',
                rawResponse: responseText
            });
        }

        // 응답 데이터 내 header 객체 추출
        const header = jsonData.response?.header;

        // resultCode가 정상이 아닐 경우('00'이 아닌 경우) 한국어 에러 메시지 반환
        if (header && header.resultCode !== '00') {
            return res.status(400).json({
                error: `공공데이터 API 오류 [${header.resultCode}]: ${header.resultMsg || '요청 처리에 실패했습니다.'}`
            });
        }

        // 정상 응답 데이터를 클라이언트에 JSON 형태로 전달 (CORS 헤더 포함)
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(jsonData);
    } catch (error) {
        // 네트워크 장애 또는 예외 발생 시 에러 메시지 반환
        return res.status(500).json({
            error: '대기오염 데이터를 가져오는 중 서버 오류가 발생했습니다.',
            message: error.message
        });
    }
}

